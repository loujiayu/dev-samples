from sys import platform

if platform == 'win32':
  import win32api
  import win32gui

  def toggle_mute():
    WM_APPCOMMAND = 0x319
    APPCOMMAND_MICROPHONE_VOLUME_MUTE = 0x180000

    hwnd_active = win32gui.GetForegroundWindow()
    win32api.SendMessage(hwnd_active, WM_APPCOMMAND, None, APPCOMMAND_MICROPHONE_VOLUME_MUTE)
  
  # WM_APPCOMMAND = 0x319
  # APPCOMMAND_MICROPHONE_VOLUME_MUTE = 0x180000

  # hwnd_active = win32gui.GetForegroundWindow()
  # win32api.SendMessage(hwnd_active, WM_APPCOMMAND, None, APPCOMMAND_MICROPHONE_VOLUME_MUTE)


# import pyaudio

# p = pyaudio.PyAudio()
# stream = p.open(format=pyaudio.paInt16, channels=4, rate=48000, input=True)

# # Mute the microphone
# stream.stop_stream()

# # Unmute the microphone
# stream.start_stream()

# import win32api
# import win32gui

# WM_APPCOMMAND = 0x319
# APPCOMMAND_MICROPHONE_VOLUME_MUTE = 0x180000

# hwnd_active = win32gui.GetForegroundWindow()
# win32api.SendMessage(hwnd_active, WM_APPCOMMAND, None, APPCOMMAND_MICROPHONE_VOLUME_MUTE)
