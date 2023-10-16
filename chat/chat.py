#Note: The openai-python library support for Azure OpenAI is in preview.
import os
import openai
openai.api_type = "azure"
openai.api_base = "https://dalle2-hackljy.openai.azure.com/"
openai.api_version = "2023-03-15-preview"
openai.api_key = '3a4a2d9764824f798b4915535ca489da'

def gpt_chat(prompt):
  response = openai.ChatCompletion.create(
    engine="chatl",
    messages = [{"role":"system","content":"You are an AI assistant that helps people find information."},{"role":"user","content": prompt}],
    temperature=0.7,
    max_tokens=800,
    top_p=0.95,
    frequency_penalty=0,
    presence_penalty=0,
    stop=None)

  return response['choices'][0]['message']['content']
  # print(response['choices'][0]['message']['content'])
