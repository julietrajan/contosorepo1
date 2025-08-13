import os
from openai import AzureOpenAI
import streamlit as st

endpoint = "https://endpoint123.cognitiveservices.azure.com/"
model_name = "gpt-5"
deployment = "gpt-5"

subscription_key = ""
api_version = "2024-12-01-preview"

client = AzureOpenAI(
    api_version=api_version,
    azure_endpoint=endpoint,
    api_key=subscription_key,
)

st.title("Azure OpenAI GPT-5 Demo")
user_input = st.text_area("Enter your prompt:", "I am going to Paris, what should I see?")

if st.button("Get Response"):
    response = client.chat.completions.create(
        messages=[
            {
                "role": "system",
                "content": "You are a helpful assistant.",
            },
            {
                "role": "user",
                "content": user_input,
            }
        ],
        max_completion_tokens=16384,
        model=deployment
    )
    st.markdown("**Response:**")
    st.write(response.choices[0].message.content)