
endpoint = "https://endpoint123.cognitiveservices.azure.com/"
model_name = "gpt-5"

subscription_key = ""
api_version = ""

client = AzureOpenAI(
    api_version=api_version,
    azure_endpoint=endpoint,
    api_key=subscription_key,
)

client = AzureOpenAI(
    api_version=api_version,
    azure_endpoint=endpoint,
    api_key=subscription_key,
)

response = client.chat.completions.create(
    messages=[
        {
            "role": "system",
            "content": "You are a helpful assistant.",
        },
        {
            "role": "user",
            "content": "I am going to Paris, what should I see?",
        }
    ],
    max_completion_tokens=16384,
    model=deployment
)


print(response.choices[0].message.content)
