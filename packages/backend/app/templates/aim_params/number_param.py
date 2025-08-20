"""
NumberValue Parameter Node Template
This node creates a NumberValue parameter that can be passed to other nodes
"""

from aim_params import NumberValue
from aim_params.core.metadata import UIMetadata

# Parameter configuration from user input
param_name = "{{PARAM_NAME}}"
param_label = "{{PARAM_LABEL}}"
param_description = "{{PARAM_DESCRIPTION}}"
value = {{VALUE}}
min_value = {{MIN_VALUE}}
max_value = {{MAX_VALUE}}
step = {{STEP}}
unit = "{{UNIT}}"
precision = {{PRECISION}}
integer_only = {{INTEGER_ONLY}}

# Create NumberValue parameter
param = NumberValue(
    name=param_name,
    ui_metadata=UIMetadata(
        label=param_label,
        description=param_description,
        default=value,
        required=True,
        editable=True
    ),
    value=value,
    min_value=min_value if min_value is not None else None,
    max_value=max_value if max_value is not None else None,
    step=step if step > 0 else None,
    unit=unit if unit else None,
    precision=precision if precision >= 0 else None,
    integer_only=integer_only
)

# Display parameter info
print(f"Created NumberValue parameter: {param_name}")
print(f"  Label: {param_label}")
print(f"  Value: {param.format_display()}")
print(f"  Range: {min_value} - {max_value}")
print(f"  Integer only: {integer_only}")

# Pass parameter to next nodes
output_data = {
    "parameter": param,
    "name": param_name,
    "value": param.value,
    "metadata": {
        "type": "NumberValue",
        "min": min_value,
        "max": max_value,
        "step": step,
        "unit": unit,
        "integer_only": integer_only
    }
}