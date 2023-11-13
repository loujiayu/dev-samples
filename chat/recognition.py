import azure.cognitiveservices.speech as speechsdk
import time
import json
from chinese import text_to_speech
from chat import gpt_chat, clear_history
from micro import toggle_mute

speech_key, service_region = "c277739dd46c49d88401e71c91e817c2","eastus"
weatherfilename="en-us_zh-cn.wav"
empty_count = 0
is_spleep = True

def speech_recognize_continuous_async_from_microphone():
    """performs continuous speech recognition asynchronously with input from microphone"""
    speech_config = speechsdk.SpeechConfig(subscription=speech_key, region=service_region)
    # The default language is "en-us".

    auto_detect_source_language_config = speechsdk.languageconfig.AutoDetectSourceLanguageConfig(languages=["zh-CN"])

    speech_recognizer = speechsdk.SpeechRecognizer(speech_config=speech_config, auto_detect_source_language_config=auto_detect_source_language_config)

    done = False

    def wakeup(text):
        print('Wakeup command: {}'.format(text))
        if 'hello gpt' in text.lower():
            print('Waking!')
            return True
        return False
    
    def sleep(text):
        if 'go to sleep'in text.lower():
            print('Sleeping!')
            return True
        return False

    def recognizing_cb(evt: speechsdk.SpeechRecognitionEventArgs):
        print('RECOGNIZING: {}'.format(evt))

    def recognized_cb(evt: speechsdk.SpeechRecognitionEventArgs):
        global empty_count
        global is_spleep
        print('Debug: recognize length {}'.format(len(evt.result.text)))

        chat_text = evt.result.text
        try:
            if is_spleep:
                if wakeup(evt.result.text):
                    is_spleep = False
                    chat_text = '你好'
                else:
                    return
            else:
                if sleep(evt.result.text):
                    is_spleep = True
                    return

            if len(chat_text) > 0:
                empty_count = 0
                toggle_mute()
                print('RECOGNIZED: {}'.format(chat_text))

                text_to_speech(gpt_chat(chat_text))

                toggle_mute()
            else:
                empty_count += 1
                if empty_count > 5:
                    print('Cleaning')
                    is_spleep = True
                    empty_count = 0
                    clear_history()

        except Exception as e:
            print('Error: {}'.format(e))

    def stop_cb(evt: speechsdk.SessionEventArgs):
        """callback that signals to stop continuous recognition"""
        print('CLOSING on {}'.format(evt))
        nonlocal done
        done = True

    # Connect callbacks to the events fired by the speech recognizer
    # speech_recognizer.recognizing.connect(recognizing_cb)
    speech_recognizer.recognized.connect(recognized_cb)
    speech_recognizer.session_stopped.connect(stop_cb)
    speech_recognizer.canceled.connect(stop_cb)

    # Perform recognition. `start_continuous_recognition_async asynchronously initiates continuous recognition operation,
    # Other tasks can be performed on this thread while recognition starts...
    # wait on result_future.get() to know when initialization is done.
    # Call stop_continuous_recognition_async() to stop recognition.
    result_future = speech_recognizer.start_continuous_recognition_async()

    result_future.get()  # wait for voidfuture, so we know engine initialization is done.
    print('Continuous Recognition is now running, say something.')

    while not done:
        # No real sample parallel work to do on this thread, so just wait for user to type stop.
        # Can't exit function or speech_recognizer will go out of scope and be destroyed while running.
        print('type "stop" then enter when done')
        stop = input()
        print(stop)
        if (stop.lower() == "stop"):
            print('Stopping async recognition.')
            speech_recognizer.stop_continuous_recognition_async()
            break

    print("recognition stopped, main thread can exit now.")

speech_recognize_continuous_async_from_microphone()