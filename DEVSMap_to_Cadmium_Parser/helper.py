
"""
def prefix_states(text, list_of_state_variables):
    '''
    Replaces each instance of "variable" by "state.variable" in text, when "variable" is followed 
    by a space or semicolon.  This restriction prevents replacing substrings that are not 
    state variables (For example, we would avoid replacing "targetnumber" by "targetstate.number" 
    if there was also a state variable called "number"). This replacement occurs for all state 
    variables in list_of_state_variables.

    Args:
        text (str):                             The input text which we are requiring to prefix the 
                                                state variable names with "state."
        list_of_state_variables (dict_items):   The list of state variables of the atomic model, returned by 
                                                atomic_model['s'].items()
    '''
    for state_variable in list_of_state_variables:
        text = text.replace(state_variable + ' ', 'state.' + state_variable + ' ')
        text = text.replace(state_variable + ';', 'state.' + state_variable + ';')
    return text
"""

import re


def normalize_string_literal(value):
    """
    Convert DEVSMap string literals into valid C++ string literals.
    Supports both single-quoted values and already double-quoted values.
    """
    if not isinstance(value, str):
        return value

    stripped = value.strip()
    if len(stripped) >= 2 and stripped[0] == stripped[-1] and stripped[0] == '"':
        return stripped

    if len(stripped) >= 2 and stripped[0] == stripped[-1] and stripped[0] == "'":
        inner = stripped[1:-1]
        return f'"{inner}"'

    return value


def prefix_states(text, list_of_state_variables):
    """
    Prefix bare state variable names with 'state.' but do not
    double-prefix variables already written as state.variable.
    """
    for state_variable in sorted(list_of_state_variables, key=len, reverse=True):
        pattern = rf'(?<![\w.]){re.escape(state_variable)}(?![\w])'
        text = re.sub(pattern, f'state.{state_variable}', text)
    return text



"""
def build_conditional_statements(data, list_of_state_variables):
    '''
    Constructs and returns if-else statements from dictionaries where the keys are conditional 
    statements and the values are instructions to execute when the conditional statement is true.
    In Cadmium, this is used to generate the bodies of the internal transition function, external 
    transition function, confluent function, output function, etc.

    This function uses the prefix_states() function to ensure that all state variables are properly
    syntaxed in C++, meaning they are of the form "state.variable_name".

    Possible cases are listed below:

    1.  If the only key is "otherwise", and there is no data: The function in question is not implemented

    2.  If "otherwise" is the only key, this is the only statement to be executed, and the returned 
        statement will not be nested in an if-else structure.

    3.  If there are keys defined that are not called "otherwise", the if-else structure will be generated 
        via the build_conditional_statements_helper() function.

    Args:
        data (dict):                            The DEVSMap dictionary containing the conditions as keys, 
                                                and the execution instructions as values, to be converted 
                                                to an if-else C++ structure.
        list_of_state_variables (dict_items):   The list of state variables for the atomic model currently 
                                                being generated.  This is returned by atomic_model['s'].items().
    '''
    #print(data)
    #print(list_of_state_variables)
    conditional_statements = ''
    if len(data) == 1:
        data = data['otherwise']
        if len(data) == 0:
            return '\t\t// Not implemented\n'
        for key in data:
            #print(key)
            #print(data)
            conditional_statements += simple_conditional_statement(key, data[key])
    else:
        conditional_statements = build_conditional_statements_helper(data)
    return prefix_states(conditional_statements, list_of_state_variables)

"""

def build_conditional_statements(data, list_of_state_variables):
    conditional_statements = ''

    if len(data) == 1 and 'otherwise' in data:
        otherwise_data = data['otherwise']

        if isinstance(otherwise_data, dict):
            if len(otherwise_data) == 0:
                return '\t\t// Not implemented\n'
            for key, value in otherwise_data.items():
                conditional_statements += simple_conditional_statement(key, value)
        else:
            conditional_statements += f'\t\t{otherwise_data};\n'
    else:
        conditional_statements = build_conditional_statements_helper(data)

    return prefix_states(conditional_statements, list_of_state_variables)


def simple_conditional_statement(key, value):
    '''
    Returns an assignment statement in C++ syntax that assigns value to a variable named key.

    Args:
        key (str):      The state variable being assigned.
        value (str):    The value to assign to the state variable.
    '''
    normalized_value = normalize_string_literal(value)
    return '\t\t' + key + ' = ' + normalized_value + ';\n'

"""
# Recursive function to write conditional blocks based on nested JSON structure
def build_conditional_statements_helper(data, indent=2):
    '''
    Helper function for build_conditional_statements().  This function generates the if-else 
    structures, and handles indentation.

    Args:
        data (dict):    The DEVSMap dictionary containing the conditions as keys, 
                        and the execution instructions as values, to be converted 
                        to an if-else C++ structure.
        indent (int):   The number of initial indentations.  In our case, the default is 2, 
                        because we assume in an atomic model we are working within a function 
                        (indent #1), that is within a class definition (indent #2).
    '''
    conditions = ''
    INDENT = "\t"  # Tab character used for indentation
    keys = list(data.keys())

    for i, key in enumerate(keys):
        value = data[key]
        is_last = (i == len(keys) - 1)
        is_otherwise = (key == "otherwise")

        # Write the condition header
        if is_otherwise:
            conditions += 'else {\n'  # Special case for "otherwise" treated as "else"
        elif i == 0:
            conditions += INDENT * indent + 'if (' + key + ') {\n'  # First condition: "if"
        else:
            conditions +='else if (' + key + ') {\n'  # Subsequent conditions: "else if"

        # Write the body of the block
        if isinstance(value, dict):
            # If all values are non-dictionaries, write assignments
            if all(not isinstance(v, dict) for v in value.values()):
                for var, expr in value.items():
                    conditions += INDENT * (indent + 1) + var + ' = ' + expr +';\n'
            else:
                # Otherwise, recursively handle nested conditions
                conditions += build_conditional_statements_helper(value, indent + 1)
        else:
            # Single assignment if value is not a dict
            conditions += INDENT * (indent + 1) + key + ' = ' + value + ';\n'

        # Write the block closing brace
        if i < len(keys) - 1:
            next_key = keys[i + 1]
            # If another block follows (assumed to be an "else"/"else if"), keep closing brace on same line
            if next_key == "otherwise" or True:  # Always true: forces inline formatting
                conditions += INDENT * indent + '} '
            else:
                conditions += INDENT * indent + '}\n'  # Default to newline
        else:
            # Last block: close normally
            conditions += INDENT * indent + '}\n'
            #Remove the else block if it is empty
            conditions = conditions.replace(' else {\n\t\t}\n', '\n')
            return conditions
            """

def build_conditional_statements_helper(data, indent=2):
    INDENT = "\t"

    normal_keys = [k for k in data.keys() if k != "otherwise"]
    has_otherwise = "otherwise" in data
    ordered_keys = normal_keys + (["otherwise"] if has_otherwise else [])

    conditions = ""

    for i, key in enumerate(ordered_keys):
        value = data[key]
        is_otherwise = (key == "otherwise")

        if i == 0 and not is_otherwise:
            conditions += INDENT * indent + f'if ({key}) {{\n'
        elif is_otherwise:
            conditions += INDENT * indent + 'else {\n'
        else:
            conditions += INDENT * indent + f'else if ({key}) {{\n'

        if isinstance(value, dict):
            if all(not isinstance(v, dict) for v in value.values()):
                for var, expr in value.items():
                    normalized_expr = normalize_string_literal(expr)
                    conditions += INDENT * (indent + 1) + f'{var} = {normalized_expr};\n'
            else:
                conditions += build_conditional_statements_helper(value, indent + 1)
        else:
            normalized_value = normalize_string_literal(value)
            conditions += INDENT * (indent + 1) + f'{key} = {normalized_value};\n'

        conditions += INDENT * indent + '}\n'

    return conditions