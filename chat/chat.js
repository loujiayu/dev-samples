const sdk = require("microsoft-cognitiveservices-speech-sdk");

speech_key = "c277739dd46c49d88401e71c91e817c2"
service_region = "eastus"

const speech_config = sdk.SpeechConfig.fromSubscription("c277739dd46c49d88401e71c91e817c2", "eastus");
// const audio_config = sdk.AudioConfig.fromAudioFileOutput('./outputaudio.wav')
sdk.AudioConfig.fromDefaultSpeakerOutput
const player = new sdk.SpeakerAudioDestination();

const audio_config = sdk.AudioConfig.fromSpeakerOutput(player)
const speech_synthesizer = new sdk.SpeechSynthesizer(speech_config, audio_config);

async function TextToSpeech(text) {
  const text2 = "Hello, world, awesome!";

  // const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'><voice name='zh-CN-XiaoxiaoNeural'>${text}</voice></speak>`
  speech_synthesizer.speakTextAsync(text2, (result) => {
    console.log(result);
    speech_synthesizer.close();

  }, (error) => {
    console.log(error)
    speech_synthesizer.close();
  })
}

TextToSpeech("");