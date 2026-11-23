param(
  [Parameter(Mandatory = $true)][string]$DataFile,
  [Parameter(Mandatory = $true)][string]$PidFile
)

$ErrorActionPreference = "SilentlyContinue"
Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase

function New-DefaultData {
  return [PSCustomObject]@{
    timer = [PSCustomObject]@{ mode = "pomodoro"; status = "idle"; remainingSec = 1500; endTimeMs = $null; completedCount = 0; activeTaskId = $null }
    tasks = @()
    settings = [PSCustomObject]@{ pomodoroMin = 25; shortBreakMin = 5; longBreakMin = 15; longBreakInterval = 4; autoStartBreaks = $false; autoStartPomodoros = $false; sound = "bell"; volume = 0.8 }
    sessions = @()
    accessedDates = @((Get-Date).ToString("yyyy-MM-dd"))
  }
}

function Save-Data($data) {
  $dir = Split-Path -Parent $DataFile
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $tmp = "$DataFile.pill.$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()).tmp"
  [System.IO.File]::WriteAllText($tmp, ($data | ConvertTo-Json -Depth 12), [System.Text.UTF8Encoding]::new($false))
  Move-Item -Path $tmp -Destination $DataFile -Force
}

function Read-State {
  if (-not (Test-Path $DataFile)) { $init = New-DefaultData; Save-Data $init; return $init }
  try {
    $raw = Get-Content -Path $DataFile -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
    return ($raw | ConvertFrom-Json)
  } catch { return $null }
}

function Get-ModeMin($data, [string]$mode) {
  switch ($mode) {
    "short_break" { if ($data.settings.shortBreakMin) { return [int]$data.settings.shortBreakMin } else { return 5 } }
    "long_break"  { if ($data.settings.longBreakMin)  { return [int]$data.settings.longBreakMin }  else { return 15 } }
    default       { if ($data.settings.pomodoroMin)   { return [int]$data.settings.pomodoroMin }   else { return 25 } }
  }
}

function Format-Time([int]$sec) {
  if ($sec -lt 0) { $sec = 0 }
  return "{0:00}:{1:00}" -f [Math]::Floor($sec / 60), ($sec % 60)
}

$dir = Split-Path -Parent $PidFile
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
Set-Content -Path $PidFile -Value $PID -Encoding UTF8

$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Pomodoro Mini" Width="188" Height="42"
        WindowStyle="None" AllowsTransparency="True" Background="Transparent"
        Topmost="True" ShowInTaskbar="False" ShowActivated="False" ResizeMode="NoResize">
  <Border x:Name="PillBorder" CornerRadius="21" Background="#F21E1E24"
          BorderBrush="#3A3A46" BorderThickness="1.2" Padding="10,4" Margin="2">
    <Border.Effect>
      <DropShadowEffect BlurRadius="10" ShadowDepth="2" Opacity="0.45" Color="#000000"/>
    </Border.Effect>
    <Grid>
      <Grid.ColumnDefinitions>
        <ColumnDefinition Width="Auto"/>
        <ColumnDefinition Width="*"/>
        <ColumnDefinition Width="Auto"/>
        <ColumnDefinition Width="Auto"/>
        <ColumnDefinition Width="Auto"/>
      </Grid.ColumnDefinitions>
      <Ellipse x:Name="ModeDot" Grid.Column="0" Width="9" Height="9" Fill="#E05A4F" VerticalAlignment="Center" Margin="0,0,7,0"/>
      <TextBlock x:Name="TimeText" Grid.Column="1" Text="25:00" Foreground="#F5F5F7" FontFamily="Consolas, Segoe UI" FontSize="15" FontWeight="SemiBold" VerticalAlignment="Center"/>
      <Button x:Name="ToggleBtn" Grid.Column="2" Content="&#9654;" Width="23" Height="23" Foreground="#F5F5F7" Background="#2C2C36" BorderThickness="0" FontSize="10" Margin="4,0,2,0" Cursor="Hand" ToolTip="Start / Pause"/>
      <Button x:Name="ResetBtn" Grid.Column="3" Content="&#8634;" Width="22" Height="23" Foreground="#B4B4C0" Background="Transparent" BorderThickness="0" FontSize="12" Margin="0,0,2,0" Cursor="Hand" ToolTip="Reset"/>
      <Button x:Name="CloseBtn" Grid.Column="4" Content="&#10005;" Width="19" Height="23" Foreground="#9CA3AF" Background="Transparent" BorderThickness="0" FontSize="11" Cursor="Hand" ToolTip="Close Mini Pill"/>
    </Grid>
  </Border>
</Window>
"@

$window = [Windows.Markup.XamlReader]::Load([System.Xml.XmlReader]::Create([System.IO.StringReader]::new($xaml)))
$screenW = [System.Windows.SystemParameters]::PrimaryScreenWidth
$screenH = [System.Windows.SystemParameters]::PrimaryScreenHeight
$posFile = Join-Path (Split-Path -Parent $DataFile) "mini-pill-pos.json"
$defaultLeft = 8
$defaultTop = $screenH - 45

if (Test-Path $posFile) {
  try {
    $pos = Get-Content -Path $posFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($null -ne $pos.left -and $null -ne $pos.top) {
      $defaultLeft = [Math]::Max(0, [Math]::Min($screenW - 188, [double]$pos.left))
      $defaultTop = [Math]::Max(0, [Math]::Min($screenH - 42, [double]$pos.top))
    }
  } catch {}
}
$window.Left = $defaultLeft
$window.Top = $defaultTop

$pillBorder = $window.FindName("PillBorder")
$modeDot = $window.FindName("ModeDot")
$timeText = $window.FindName("TimeText")
$toggleBtn = $window.FindName("ToggleBtn")
$resetBtn = $window.FindName("ResetBtn")
$closeBtn = $window.FindName("CloseBtn")
$brushConv = [System.Windows.Media.BrushConverter]::new()

$pillBorder.Add_MouseLeftButtonDown({
  param($s, $e)
  if ($e.ButtonState -eq [System.Windows.Input.MouseButtonState]::Pressed) {
    $window.DragMove()
    try {
      $posJson = @{ left = [Math]::Round($window.Left); top = [Math]::Round($window.Top) } | ConvertTo-Json -Compress
      [System.IO.File]::WriteAllText($posFile, $posJson, [System.Text.UTF8Encoding]::new($false))
    } catch {}
  }
})
$closeBtn.Add_Click({ $window.Close() })

$resetBtn.Add_Click({
  $data = Read-State; if ($null -eq $data -or $null -eq $data.timer) { return }
  $sec = (Get-ModeMin $data $data.timer.mode) * 60
  $data.timer.status = "idle"; $data.timer.remainingSec = $sec; $data.timer.endTimeMs = $null
  Save-Data $data
})

$toggleBtn.Add_Click({
  $data = Read-State; if ($null -eq $data -or $null -eq $data.timer) { return }
  $nowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  if ($data.timer.status -eq "running") {
    $rem = if ($null -ne $data.timer.endTimeMs) { [Math]::Max(0, [int][Math]::Round(([double]$data.timer.endTimeMs - $nowMs) / 1000)) } else { [int]$data.timer.remainingSec }
    $data.timer.status = "paused"; $data.timer.remainingSec = $rem; $data.timer.endTimeMs = $null
  } else {
    $rem = [int]$data.timer.remainingSec
    if ($rem -le 0) { $rem = (Get-ModeMin $data $data.timer.mode) * 60 }
    $data.timer.status = "running"; $data.timer.remainingSec = $rem; $data.timer.endTimeMs = $nowMs + ($rem * 1000)
  }
  Save-Data $data
})

$timer = [System.Windows.Threading.DispatcherTimer]::new()
$timer.Interval = [TimeSpan]::FromMilliseconds(400)
$timer.Add_Tick({
  $data = Read-State; if ($null -eq $data -or $null -eq $data.timer) { return }
  $t = $data.timer
  $colorHex = switch ($t.mode) { "short_break" { "#389E8B" }; "long_break" { "#4A7FC1" }; default { "#E05A4F" } }
  $modeDot.Fill = $brushConv.ConvertFromString($colorHex)
  $rem = [int]$t.remainingSec

  if ($t.status -eq "running" -and $null -ne $t.endTimeMs) {
    $nowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $rem = [Math]::Max(0, [int][Math]::Round(([double]$t.endTimeMs - $nowMs) / 1000))
    $toggleBtn.Content = [char]0x23F8
    $pillBorder.BorderBrush = $brushConv.ConvertFromString($colorHex)
  } else {
    $toggleBtn.Content = [char]0x25B6
    $pillBorder.BorderBrush = $brushConv.ConvertFromString("#3A3A46")
  }
  $timeText.Text = Format-Time $rem
})

$window.Add_Closed({
  $timer.Stop()
  if (Test-Path $PidFile) { Remove-Item -Path $PidFile -Force }
})

$timer.Start()
[void]$window.ShowDialog()
