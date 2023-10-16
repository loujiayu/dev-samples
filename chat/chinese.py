import azure.cognitiveservices.speech as speechsdk
import os

# Replace with your own subscription key and region
speech_key = "c277739dd46c49d88401e71c91e817c2"
service_region = "eastus"

# Create a speech synthesizer object with the specified settings
speech_config = speechsdk.SpeechConfig(subscription=speech_key, region=service_region)
speech_synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config)

def text_to_speech(text):
  ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'><voice name='zh-CN-XiaoxiaoNeural'>{0}</voice></speak>".format(text)
  re = speech_synthesizer.speak_ssml_async(ssml).get()
  print(re)
  print("Speech synthesized for text [{}]".format(text))

# text_to_speech("满意吗 a speech synthesizer object with the specified settings a speech synthesizer object with the specified settings")