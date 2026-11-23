param(
  [Parameter(Mandatory = $true)][string]$TitleB64,
  [Parameter(Mandatory = $true)][string]$BodyB64,
  [string]$AccentHex = "#E05A4F",
  [string]$Sound = "bell",
  [double]$Volume = 0.8,
  [int]$DurationSec = 12,
  [string]$DataFile = "",
  [string]$ActionLabelB64 = ""
)

$ErrorActionPreference = "SilentlyContinue"
Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase

function Decode-B64([string]$b64) {
  try { return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b64)) }
  catch { return "" }
}

function Play-SynthesizedWav([string]$kind, [double]$vol) {
  $v = [Math]::Max(0.05, [Math]::Min(1.0, $vol))
  if ($vol -le 0.01) { return }
  $sr = 22050
  $dur = 1.25
  $count = [int]($sr * $dur)
  $pcm = New-Object byte[] ($count * 2)
  $twoPi = 2.0 * [Math]::PI

  for ($i = 0; $i -lt $count; $i++) {
    $t = $i / [double]$sr
    $val = 0.0
    if ($kind -eq "beep") {
      $slot = [Math]::Floor($t / 0.35)
      $lt = $t - ($slot * 0.35)
      if ($slot -lt 3 -and $lt -lt 0.16) {
        $env = [Math]::Min(1.0, $lt / 0.01) * [Math]::Min(1.0, (0.16 - $lt) / 0.02)
        $val = [Math]::Sin($twoPi * 1046.5 * $t) * $env * 0.55
      }
    } elseif ($kind -eq "chime") {
      $notes = @(523.25, 659.25, 783.99)
      for ($n = 0; $n -lt 3; $n++) {
        $dt = $t - ($n * 0.18)
        if ($dt -ge 0) {
          $env = [Math]::Exp(-$dt * 4.5) * [Math]::Min(1.0, $dt / 0.015)
          $val += ([Math]::Sin($twoPi * $notes[$n] * $dt) + 0.3 * [Math]::Sin($twoPi * ($notes[$n] * 2) * $dt)) * $env * 0.32
        }
      }
    } else {
      foreach ($st in @(0.0, 0.42)) {
        $dt = $t - $st
        if ($dt -ge 0) {
          $env = [Math]::Exp(-$dt * 5.2) * [Math]::Min(1.0, $dt / 0.008)
          $val += ([Math]::Sin($twoPi * 880 * $dt) * 0.65 + [Math]::Sin($twoPi * 1760 * $dt) * 0.25 + [Math]::Sin($twoPi * 2640 * $dt) * 0.12) * $env * 0.55
        }
      }
    }
    $s = [int][Math]::Max(-32767, [Math]::Min(32767, $val * $v * 32767))
    $idx = $i * 2
    $pcm[$idx] = [byte]($s -band 0xFF)
    $pcm[$idx + 1] = [byte](($s -shr 8) -band 0xFF)
  }

  $ms = New-Object System.IO.MemoryStream
  $bw = New-Object System.IO.BinaryWriter($ms)
  $bw.Write([System.Text.Encoding]::ASCII.GetBytes("RIFF"))
  $bw.Write([int](36 + $pcm.Length))
  $bw.Write([System.Text.Encoding]::ASCII.GetBytes("WAVEfmt "))
  $bw.Write([int]16); $bw.Write([int16]1); $bw.Write([int16]1)
  $bw.Write([int]$sr); $bw.Write([int]($sr * 2)); $bw.Write([int16]2); $bw.Write([int16]16)
  $bw.Write([System.Text.Encoding]::ASCII.GetBytes("data"))
  $bw.Write([int]$pcm.Length)
  $bw.Write($pcm)
  $bw.Flush()
  $ms.Position = 0
  $player = [System.Media.SoundPlayer]::new($ms)
  $player.Play()
}

$titleText = Decode-B64 $TitleB64
$bodyText = Decode-B64 $BodyB64
$actionLabel = if ($ActionLabelB64) { Decode-B64 $ActionLabelB64 } else { "" }

try {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class PomodoroWin32 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
"@ -ErrorAction SilentlyContinue
} catch {}

function Focus-AntigravityWindow {
  try {
    $procs = Get-Process | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero -and $_.ProcessName -match "Antigravity" }
    if (-not $procs) {
      $procs = Get-Process | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero -and $_.MainWindowTitle -match "Antigravity|Pomodoro" }
    }
    $target = $procs | Select-Object -First 1
    if ($target) {
      $hwnd = $target.MainWindowHandle
      if ([PomodoroWin32]::IsIconic($hwnd)) { [void][PomodoroWin32]::ShowWindowAsync($hwnd, 9) }
      [void][PomodoroWin32]::SetForegroundWindow($hwnd)
    }
  } catch {}
}

function Start-NextSessionFromFile {
  if ([string]::IsNullOrWhiteSpace($DataFile) -or -not (Test-Path $DataFile)) { return }
  try {
    $raw = [System.IO.File]::ReadAllText($DataFile, [System.Text.UTF8Encoding]::new($false))
    if ([string]::IsNullOrWhiteSpace($raw)) { return }
    $data = $raw | ConvertFrom-Json
    if ($null -eq $data -or $null -eq $data.timer) { return }
    if ($data.timer.status -eq "running") { return }

    $rem = [int]$data.timer.remainingSec
    if ($rem -le 0) {
      $modeMin = switch ($data.timer.mode) {
        "short_break" { if ($data.settings.shortBreakMin) { [int]$data.settings.shortBreakMin } else { 5 } }
        "long_break"  { if ($data.settings.longBreakMin)  { [int]$data.settings.longBreakMin }  else { 15 } }
        default       { if ($data.settings.pomodoroMin)   { [int]$data.settings.pomodoroMin }   else { 25 } }
      }
      $rem = $modeMin * 60
    }
    $nowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $data.timer.status = "running"
    $data.timer.remainingSec = $rem
    $data.timer.endTimeMs = $nowMs + ($rem * 1000)

    $tmp = "$DataFile.notify.$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()).tmp"
    [System.IO.File]::WriteAllText($tmp, ($data | ConvertTo-Json -Depth 12), [System.Text.UTF8Encoding]::new($false))
    Move-Item -Path $tmp -Destination $DataFile -Force
  } catch {}
}

$winHeight = if ($actionLabel) { 126 } else { 96 }
$topOffset = $winHeight + 12

$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Pomodoro Notification" Width="348" Height="$winHeight"
        WindowStyle="None" AllowsTransparency="True" Background="Transparent"
        Topmost="True" ShowInTaskbar="False" ShowActivated="False" ResizeMode="NoResize">
  <Border x:Name="Card" CornerRadius="12" Background="#F51B1B22"
          BorderBrush="#353542" BorderThickness="1.2" Margin="4" Cursor="Hand">
    <Border.Effect>
      <DropShadowEffect BlurRadius="14" ShadowDepth="3" Opacity="0.55" Color="#000000"/>
    </Border.Effect>
    <Grid>
      <Grid.ColumnDefinitions>
        <ColumnDefinition Width="5"/>
        <ColumnDefinition Width="*"/>
        <ColumnDefinition Width="Auto"/>
      </Grid.ColumnDefinitions>
      <Border x:Name="AccentBar" Grid.Column="0" Background="$AccentHex" CornerRadius="11,0,0,11"/>
      <StackPanel Grid.Column="1" VerticalAlignment="Center" Margin="12,8,8,8">
        <TextBlock x:Name="TitleBlock" Foreground="#FFFFFF" FontFamily="Segoe UI"
                   FontSize="14" FontWeight="SemiBold" TextTrimming="CharacterEllipsis"/>
        <TextBlock x:Name="BodyBlock" Foreground="#CBD5E1" FontFamily="Segoe UI"
                   FontSize="12" TextWrapping="Wrap" Margin="0,4,0,0"/>
        <Button x:Name="ActionBtn" Visibility="Collapsed" HorizontalAlignment="Left"
                Margin="0,8,0,0" Padding="10,4" Foreground="#FFFFFF" Background="$AccentHex"
                BorderThickness="0" FontFamily="Segoe UI" FontSize="11.5" FontWeight="SemiBold" Cursor="Hand">
          <Button.Resources>
            <Style TargetType="Border">
              <Setter Property="CornerRadius" Value="6"/>
            </Style>
          </Button.Resources>
        </Button>
      </StackPanel>
      <Button x:Name="CloseBtn" Grid.Column="2" Content="&#10005;" Width="24" Height="24"
              VerticalAlignment="Top" Margin="0,6,6,0" Foreground="#94A3B8"
              Background="Transparent" BorderThickness="0" FontSize="11" Cursor="Hand"/>
    </Grid>
  </Border>
</Window>
"@

$window = [Windows.Markup.XamlReader]::Load([System.Xml.XmlReader]::Create([System.IO.StringReader]::new($xaml)))
$workArea = [System.Windows.SystemParameters]::WorkArea
$window.Left = $workArea.Right - 360
$window.Top = $workArea.Bottom - $topOffset

$window.FindName("TitleBlock").Text = $titleText
$window.FindName("BodyBlock").Text = $bodyText

$closeBtn = $window.FindName("CloseBtn")
$actionBtn = $window.FindName("ActionBtn")
$card = $window.FindName("Card")

if ($actionLabel) {
  $actionBtn.Content = [string][char]0x25B6 + " " + $actionLabel
  $actionBtn.Visibility = [System.Windows.Visibility]::Visible
}

$actionBtn.Add_Click({
  param($s, $e)
  $e.Handled = $true
  Start-NextSessionFromFile
  Focus-AntigravityWindow
  $window.Close()
})

$closeBtn.Add_Click({
  param($s, $e)
  $e.Handled = $true
  $window.Close()
})

$card.Add_MouseLeftButtonUp({
  param($s, $e)
  if ($e.OriginalSource -eq $closeBtn -or $e.OriginalSource -eq $actionBtn) { return }
  Focus-AntigravityWindow
  $window.Close()
})

$closeTimer = [System.Windows.Threading.DispatcherTimer]::new()
$closeTimer.Interval = [TimeSpan]::FromSeconds([Math]::Max(3, $DurationSec))
$closeTimer.Add_Tick({ $closeTimer.Stop(); $window.Close() })

$window.Add_Loaded({
  Play-SynthesizedWav $Sound $Volume
  $closeTimer.Start()
})
$window.Add_Closed({ $closeTimer.Stop() })

[void]$window.ShowDialog()
