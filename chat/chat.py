#Note: The openai-python library support for Azure OpenAI is in preview.
import os
import openai
openai.api_type = "azure"
openai.api_base = "https://chatbotljy.openai.azure.com/"
openai.api_version = "2023-07-01-preview"
openai.api_key = 'bf9a27e0a4d44e5285c1da1dac1d86ba'

system_content = {"role":"system","content":"你的名字叫八戒"}

conversation_history = [
  system_content
]

def clear_history():
  global conversation_history
  conversation_history = [
    system_content
  ]

def gpt_chat(prompt):
  conversation_history.append({"role":"user","content": prompt})
  response = openai.ChatCompletion.create(
    engine="gpt4",
    messages = conversation_history,
    temperature=0.7,
    max_tokens=800,
    top_p=0.95,
    frequency_penalty=0,
    presence_penalty=0,
    stop=None)

  print('responding')
  conversation_history.append({"role":"system","content": response['choices'][0]['message']['content']})

  return response['choices'][0]['message']['content']


# gpt_chat("我今年五岁了")