#Note: The openai-python library support for Azure OpenAI is in preview.
import os
import openai
openai.api_type = "azure"
openai.api_base = "https://dalle2-hackljy.openai.azure.com/"
openai.api_version = "2023-03-15-preview"
openai.api_key = '3a4a2d9764824f798b4915535ca489da'

response = openai.ChatCompletion.create(
  engine="chatl",
  messages = [{"role":"system","content":"You are an AI assistant that helps people find information."},{"role":"user","content":"你知道小松鼠吗"}],
  temperature=0.7,
  max_tokens=800,
  top_p=0.95,
  frequency_penalty=0,
  presence_penalty=0,
  stop=None)


print(response['choices'][0]['message']['content'])
