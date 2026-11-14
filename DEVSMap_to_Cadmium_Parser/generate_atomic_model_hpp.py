# TODO module comments

from .generate_simple_statements import *
from .helper import *
import re


def generate_atomic_models(directory_cpp_code, data):
    '''
    Loops through all atomic models and generates the .hpp file for each one.

    Args:
        directory_cpp_code (str):   The output directory to place the .hpp files.
        data (dict):                The DEVSMap json data that has been sorted into a dictionary.
    '''
    number_of_atomic_models = len(data['atomic_models'])
    code = []

    for i in range(number_of_atomic_models):
        atomic_entry = data['atomic_models'][i]
        atomic_json = atomic_entry["json"]

        atomic_model_name = list(atomic_json.keys())[0]
        atomic_model = atomic_json[atomic_model_name]

        code.append(
            generate_atomic_model(
                directory_cpp_code,
                data['init_states'],
                atomic_model_name,
                atomic_model
            )
        )

    return code


def generate_atomic_model(directory, init_states, atomic_model_name, atomic_model):
    '''
    Creates a .hpp file in directory, and generates the C++ code for the atomic model within that file.

    Args:
        directory (str):            The output directory to place the .hpp file.
        atomic_model_name (str):    The name of the atomic model, which will also be the name of the .hpp file.
        atomic_model (dict):        The DEVSMap data of the atomic model to generate the C++ code from.
    '''
    state_name = get_state_name(atomic_model_name)
    # output_filepath = directory + atomic_model_name + '.hpp'
    # with open(output_filepath, 'w') as file:
    #     file.write(generate_file_definition(atomic_model_name))
    #     file.write(include_iostream())
    #     file.write(include_atomic())
    #     file.write(cadmium_namespace())
    #     file.write(generate_state_struct(init_states, state_name, atomic_model))
    #     file.write(generate_bitshift_override_function(state_name, atomic_model))
    #     file.write(generate_class(atomic_model_name, state_name, atomic_model))
    #     file.write('#endif') 
    # file.close()

    file_name = atomic_model_name + ".hpp"
    file_content = generate_file_definition(atomic_model_name)
    file_content += include_string()
    file_content += include_iostream()
    file_content += include_atomic()
    file_content += cadmium_namespace()
    file_content += generate_state_struct(init_states, state_name, atomic_model)
    file_content += generate_bitshift_override_function(state_name, atomic_model)
    file_content += generate_class(atomic_model_name, state_name, atomic_model)
    file_content += '#endif'
    return {file_name: file_content}


def include_iostream():
    '''
    Returns the C++ statement to include the 'iostream' library.
    '''
    return "#include <iostream>\n"

    
def include_atomic():
    '''
    Returns the C++ statement to include Cadmium's C++ definition of an atomic model.
    '''
    return "#include \"cadmium/modeling/devs/atomic.hpp\"\n\n"


def get_state_name(model_name):
    '''
    Returns model_name with "State" appended.  For example, "counter" becomes "counterState".
    This allows us to work with State objects for atomic models in Cadmium.

    Args:
        model_name (str):   The name of the atomic model.
    '''
    return model_name + "State"
        

# TODO Only the first part is implemented, the else will be temporarily implemented 
# to allow for code reuse of an atomic model with different initialization values 
# (after which the if statement can be removed)
def generate_state_struct(init_states, state_name, model):
    '''
    NOTE: Temporary function to abstract out a deferred feature (atomic model code reuse)
    '''
    # Apply the appropriate generator function based on whether or not the 
    # atomic model is reused with different initialization states
    reuse = False
    if not reuse:
        # this always happens for now
        return generate_state_struct_no_parameters(init_states, state_name, model)
    else:
        # NOT IMPLEMENTED
        return generate_state_struct_with_parameters(state_name, model)
    
    
# TODO CHANGE PARAMETER NAMES IN RECURSIVE FUNCTION
def find_initialization_values_for_model(init_state, state_variable_names):
    '''
    Returns the initialization values of each state variable for an atomic model.

    Args:
        init_states (dict):                 The DEVSMap dictionary init states data for all models. 
                                            Given by data['init_states'].
        state_variable_names (dict_keys):   The names of all state variables for the atomic model 
                                            being generated. Given by model['s'].keys().
    '''
    def recursive_search(obj):
        if isinstance(obj, dict):
            if obj.keys() == state_variable_names:
                return obj
            for value in obj.values():
                result = recursive_search(value)
                if result:
                    return result
        elif isinstance(obj, list):
            for item in obj:
                result = recursive_search(item)
                if result:
                    return result
        return None    
    return recursive_search(init_state)


def generate_state_struct_no_parameters(init_states, state_name, model):
    '''
    NOTE: Temporary function while atomic model code reuse is not implemented.
    Generates the state struct for an atomic model, assuming that all atomic
    models share the same initialization values.

    Args:
        init_states (dict): The DEVSMap dictionary init states data for all models. 
                            Given by data['init_states']
        state_name (str):   The name of the atomic model's state object.
        model (dict):       The DEVSMap dictionary data for the atomic model being generated.
    '''
    state_struct = ''
    state_variables = model['s'].items()
    state_variable_names = model['s'].keys()
    
    state_struct += 'struct ' + state_name + ' {\n'
    
    declarations = ''
    for variable_name, variable_type in state_variables:
        if variable_type == "string":
            variable_type = 'std::' + variable_type
        declarations += '\t' + variable_type + ' ' + variable_name + ';\n'
    state_struct += declarations
    
    state_struct += '\n\texplicit ' + state_name + '(): '
    
    # This is intentionally inefficient with a second for loop to allow for decoupling of the initializations later (for atomic models that are re-used with different inititalization values)
    initialization_values = find_initialization_values_for_model(init_states, state_variable_names)
    
    initializations = ''
    for variable_name, variable_type in state_variables:
        value = initialization_values[variable_name]
        initializations += ' ' + variable_name + '(' + value + '), '
    
    state_struct += initializations.rstrip(', ')
    
    state_struct += ' {\n\t}\n};\n\n'
    state_struct = replace_inf(state_struct)
    
    return state_struct  


def generate_state_struct_with_parameters(state_name, model):
    '''
    '''
    #TODO
    return "Code reuse functionality is not yet implemented.  Code reuse is being attempted on the model: " + state_name.replace('State', '')


def generate_bitshift_override_function(state_name, model):
    '''
    Returns a C++ function to override the << operator for the atomic model being generated.

    Args:
        state_name (str):   The name of the atomic model's state object.
        model (dict):       The The DEVSMap dictionary data for the atomic model being generated.
    '''
    state_variables = model['s'].keys() 
    function = ''
    function += '#ifndef NO_LOGGING\n'
    function += '\tstd::ostream& operator<<(std::ostream &out, const ' + state_name + '& state) {\n'
    
    if (len(state_variables)) > 0:
        function += '\t\tout << "{'
    
        for variable_name in state_variables:
            function += variable_name + ': " << state.' + variable_name + ' << ", '
        function = function.rstrip(', ')
        function += '}";\n'
    else:
        # Error message for state set cannot be null
        function += ''
        
    function += '\t\treturn out;\n'
    function += '\t}\n#endif\n\n'
    
    return function
    
    
def generate_class(model_name, state_name, model):
    '''
    #TODO confluent function is a later item
    Returns the C++ class definition for the atomic model being generated.  This includes 
    the port declarations, class constructor, internal transition function, external 
    transition function, output function, and time advance function.

    Args:
        model_name (str):   The name of the atomic model being generated.
        state_name (str):   The name of the atomic model's state object.
        model (dict):       The The DEVSMap dictionary data for the atomic model being generated.
    '''
    
    #Organize some variables to pass to the generators
    #INEFFICIENT - could pass these directly - readability vs. efficiency tradeoff
    list_of_state_variables = list(model['s'].keys())
    input_ports = model['x']
    output_ports = model['y']
    delta_int = model['delta_int']
    delta_ext = model['delta_ext']
    #delta_con = model['delta_con'] # not implemented
    lambda_func = model['lambda'] # lambda is a python keyword and cannot be used
    ta = model['ta']
    
    #print(list_of_state_variables)
    #print(delta_int)
    #print(delta_ext)
    #print(lambda_func)
    #print(ta)
    
    class_definition = 'class ' + model_name + ' : public Atomic<' + state_name + '> {\n'
    class_definition += generate_port_declarations(input_ports, output_ports) + generate_class_constructor(model_name, state_name, input_ports, output_ports) + generate_internal_transition(state_name, delta_int, list_of_state_variables) + generate_external_transition(state_name, delta_ext, list_of_state_variables) + generate_output_function(state_name, lambda_func, list_of_state_variables) + generate_time_advance_function(state_name, ta, list_of_state_variables)
    class_definition += '};\n\n'
    
    return class_definition


def generate_port_declarations(input_ports, output_ports):
    '''
    # TODO: only using public declarations for now.  Will use private declarations 
    # after implementing "constants"/DEVS parameters.
    NOTE: This function is intentionally inefficient for readability purposes.

    Returns C++ code to declare all of the input and output ports for the atomic model being generated.
    
    Args:
        input_ports (dict):     The DEVSMap dictionary data for the atomic model's input ports, 
                                given by model_name['x']
        output_ports (dict):    The DEVSMap dictionary data for the atomic model's input ports, 
                                given by model_name['y']
    '''   
    port_declarations = '\tpublic:\n'
    # input ports
    port_declarations += '\t//input ports\n'
    for port_name in input_ports:
        data_type = input_ports[port_name]
        if data_type == "string":
            data_type = 'std::' + data_type
        port_declarations += '\tPort<' + data_type + '> ' + port_name + ';\n'
    # output ports
    port_declarations += '\n\t//output ports\n'
    for port_name in output_ports:
        data_type = output_ports[port_name]
        if data_type == "string":
            data_type = 'std::' + data_type
        port_declarations += '\tPort<' + data_type + '> ' + port_name + ';\n'
    return port_declarations + '\n'


def generate_class_constructor(model_name, state_name, input_ports, output_ports):
    '''
    Returns C++ code that is the constructor for the atomic model being generated.
    
    Args:
        model_name (str):       The name of the atomic model being generated.
        state_name (str):       The name of the atomic model's state object.
        input_ports (dict):     The DEVSMap dictionary data for the atomic model's input ports, 
                                given by model_name['x']
        output_ports (dict):    The DEVSMap dictionary data for the atomic model's input ports, 
                                given by model_name['y']
    '''   
    port_initializations = '\t' + model_name + '(const std::string id) : Atomic<' + state_name + '>(id, ' + state_name + '()) {\n'
    
    # input ports
    port_initializations += '\t\t//input ports\n'
    for port_name in input_ports:
        data_type = input_ports[port_name]
        if data_type == "string":
            data_type = 'std::' + data_type
        port_initializations += '\t\t' + port_name + ' = addInPort<' + data_type + '>("' + port_name + '");\n'    
    
    # output ports
    port_initializations += '\n\t\t//output ports\n'
    for port_name in output_ports:
        data_type = output_ports[port_name]
        if data_type == "string":
            data_type = 'std::' + data_type
        port_initializations += '\t\t' + port_name + ' = addOutPort<' + data_type + '>("' + port_name + '");\n'
    
    port_initializations += '\t}\n\n'
    return port_initializations


def generate_internal_transition(state_name, delta_int, list_of_state_variables):
    '''
    Returns the internal transition function for the atomic model being generated.

    Args:
        state_name (str):                       The name of the atomic model's state object.
        delta_int (dict):                       The DEVSMap dictionary data for the internal transition function,
                                                given by model_name['delta_int']
        list_of_state_variables (dict_items):   The list of state variables of the atomic model, returned by 
                                                atomic_model['s'].items()
    '''
    internal_transition_function = '\tvoid internalTransition(' + state_name + '& state) const override {\n'
    internal_transition_function += build_conditional_statements(delta_int, list_of_state_variables)
    internal_transition_function += '\t}\n\n'
    internal_transition_function = replace_inf(internal_transition_function)
    return internal_transition_function


def generate_external_transition(state_name, delta_ext, list_of_state_variables):
    '''
    # TODO refactor this to use a helper function, so it is structured like the generate_internal_transition() above

    Returns the external transition function for the atomic model being generated.

    Args:
        state_name (str):                       The name of the atomic model's state object.
        delta_ext (dict):                       The DEVSMap dictionary data for the external transition function,
                                                given by model_name['delta_ext']
        list_of_state_variables (dict_items):   The list of state variables of the atomic model, returned by 
                                                atomic_model['s'].items()
    '''
    external_transition_function = '\tvoid externalTransition(' + state_name + '& state, double e) const override {\n'
    
    conditional_statements = build_conditional_statements(delta_ext, list_of_state_variables)
    external_transition_body = ''
    
    # Go through the if/else structure and convert JSON bag operators to the correct C++ functions and syntax
    for line in conditional_statements.splitlines(True): # True keeps the linebreaks in
        # remove tabs to check what the line starts with
        templine = line.lstrip('\t')
        # if the line is building the condition, we are making changes based on the bag size
        if (templine.startswith('if') or templine.startswith('else if') or templine.startswith('else') or templine.startswith('{') or templine.startswith('}')):
            # replaces "variable_name.bagSize() != 0" with !variable_name->empty()
            line = re.sub(r'\b([a-zA-Z_][a-zA-Z0-9_]*)\.bagSize\(\) != 0', r'!\1->empty()', line)
            # replaces "variable_name.bagSize() == 0" with variable_name->empty()
            line = re.sub(r'\b([a-zA-Z_][a-zA-Z0-9_]*)\.bagSize\(\) == 0', r'\1->empty()', line)
            external_transition_body += line            
        # if the line is an instruction, we are making changes based on getting the last value from the bag
        else:
            # replaces "variablename.bag(-1)" with "variablename->getBag().back()"
            line = re.sub(r'\b([a-zA-Z_][a-zA-Z0-9_]*)\.bag\(-1\)', r'\1->getBag().back()', line)
            external_transition_body += line
            
    external_transition_function += external_transition_body    
    
    external_transition_function += '\t}\n\n'
    return external_transition_function


def generate_output_function(state_name, lambda_func, list_of_state_variables):
    '''
    Returns the output function for the atomic model being generated.

    Args:
        state_name (str):                       The name of the atomic model's state object.
        lambda_func (dict):                     The DEVSMap dictionary data for the output function,
                                                given by model_name['lambda']
        list_of_state_variables (dict_items):   The list of state variables of the atomic model, returned by 
                                                atomic_model['s'].items()
    '''
    # READ ALL COMMENTS BEFORE EDITING
    output_function = '\tvoid output(const ' + state_name + '& state) const override {\n'
    
    # Get the if-else if-else structure
    conditional_statements = build_conditional_statements(lambda_func, list_of_state_variables)
    output_body = ''
    
    # Go through the if/else structure and convert variable assignments to the correct output function syntax
    for line in conditional_statements.splitlines(True): # True keeps the linebreaks in
        # remove tabs to check what the line starts with
        templine = line.lstrip('\t')
        # if the line is building the condition, we add it to the output_body unchanged
        # IF THIS FUNCTION IS BROKEN IT IS MOST LIKELY THE LINE BELOW, WHICH DOES NOT YET CAPTURE EVERY USE CASE
        if (templine.startswith('if') or templine.startswith('else if') or templine.startswith('else') or templine.startswith('{') or templine.startswith('}')):
            output_body += line
        else:
            # if the line is a variable assignment, we convert it to use the addMessage function in Cadmium.
            line = line.replace(' = ', '->addMessage(')
            line = line.replace(';', ');')
            output_body += line
    output_function += output_body
    
    output_function += '\t}\n\n'  
    
    return output_function


def generate_time_advance_function(state_name, ta, list_of_state_variables):
    '''
    Returns the time advance function for the atomic model being generated.

    Each value in ta is an expression (for example "sigma", "0", "inf" or
    "sigma * 2"): state variables are prefixed with "state." and inf is
    converted to C++. With more than one branch, every guard gets its own
    return statement and the "otherwise" branch is the final return.

    Args:
        state_name (str):                       The name of the atomic model's state object.
        ta (dict):                              The DEVSMap dictionary data for the time advance function,
                                                given by model_name['ta']
        list_of_state_variables (list):         The names of the atomic model's state variables, from
                                                list(atomic_model['s'].keys())
    '''
    if 'otherwise' not in ta:
        raise ValueError(state_name + ": the time advance function needs an 'otherwise' branch")
    for guard, value in ta.items():
        if not isinstance(value, str):
            raise ValueError(state_name + ": time advance values must be expressions such as \"sigma\"; "
                             "got " + repr(value) + " for " + repr(guard))

    time_advance_function = '\t[[nodiscard]] double timeAdvance(const ' + state_name + '& state) const override {\n'

    guards = [guard for guard in ta if guard != 'otherwise']
    for i, guard in enumerate(guards):
        keyword = 'if' if i == 0 else 'else if'
        time_advance_function += '\t\t' + keyword + ' (' + prefix_states(guard, list_of_state_variables) + ') {\n'
        time_advance_function += '\t\t\treturn ' + prefix_states(ta[guard], list_of_state_variables) + ';\n'
        time_advance_function += '\t\t}\n'
    time_advance_function += '\t\treturn ' + prefix_states(ta['otherwise'], list_of_state_variables) + ';\n'

    time_advance_function += '\t}\n\n'
    return replace_inf(time_advance_function)




        