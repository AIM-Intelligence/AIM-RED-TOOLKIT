"""
Mock Model Node Template
Uses AIM-RedLab's MockProvider to simulate LLM responses
"""

from aim_models import MockProvider
import asyncio
import json

# Get temperature parameter (default 1.0)
temperature = 1.0
prompt = "Generate text"

# Extract temperature from input
if 'temperature' in input_data:
    temp_data = input_data['temperature']
    # NumberParam sends both 'parameter' object and 'value' directly
    # For MockModel, we only need the value
    if isinstance(temp_data, dict) and 'value' in temp_data:
        temperature = temp_data['value']
    elif isinstance(temp_data, (int, float)):
        temperature = float(temp_data)

# Extract prompt if provided
if 'prompt' in input_data:
    prompt_data = input_data['prompt']
    if isinstance(prompt_data, dict):
        if 'value' in prompt_data:
            prompt = prompt_data['value']
    elif isinstance(prompt_data, str):
        prompt = prompt_data

# Validate temperature range
temperature = max(0.1, min(2.0, temperature))

print(f"🤖 Mock Model Processing (using AIM-RedLab MockProvider)")
print(f"Temperature: {temperature:.2f}")
print(f"Prompt: {prompt[:50]}..." if len(prompt) > 50 else f"Prompt: {prompt}")

# Create MockProvider instance with temperature-based config
config = {
    "temperature": temperature,
    "deterministic": temperature < 0.5,  # Low temperature = more deterministic
    "response_delay": 0.1 + (temperature * 0.2)  # Higher temperature = slower
}

# Initialize MockProvider from AIM-RedLab
model = MockProvider(
    name="mock-model-node",
    model_id="mock-gpt-4",
    config=config
)

# Generate response using MockProvider
async def generate_response():
    response = await model.generate(
        prompt=prompt,
        temperature=temperature,
        max_tokens=100
    )
    return response

# Run async generation
response = asyncio.run(generate_response())

# Extract generated text
generated_text = response.content if hasattr(response, 'content') else str(response)

print(f"\n📝 Generated Text:")
print(f"{generated_text}")
print(f"\n⚙️ Model Statistics (from AIM-RedLab MockProvider):")
print(f"  - Model: {model.model_id}")
print(f"  - Temperature: {temperature:.2f}")
if hasattr(response, 'usage'):
    print(f"  - Tokens: {response.usage}")
if hasattr(response, 'response_time'):
    print(f"  - Response Time: {response.response_time:.3f}s")

# Output the complete ModelResponse object for next nodes
# This ensures compatibility with downstream components (Judge, Report, etc.)
output_data = {
    # Serialize the response properly
    "response_dict": response.to_dict() if hasattr(response, 'to_dict') else {
        "content": str(response),
        "model": model.model_id,
        "temperature": temperature
    },
    # Also provide direct access to commonly used fields
    "content": response.content if hasattr(response, 'content') else str(response),
    "model": response.model if hasattr(response, 'model') else model.model_id,
    "usage": response.usage.to_dict() if hasattr(response, 'usage') and hasattr(response.usage, 'to_dict') else str(response.usage) if hasattr(response, 'usage') else {},
    "metadata": response.metadata if hasattr(response, 'metadata') else {},
    "latency_ms": response.latency_ms if hasattr(response, 'latency_ms') else 0,
    "success": response.success if hasattr(response, 'success') else True
}

# Serialize the output data for next nodes
serialized_output = serialize_object(output_data)

# Output the result for next nodes
print("___OUTPUT_DATA_START___")
print(json.dumps(serialized_output))
print("___OUTPUT_DATA_END___")