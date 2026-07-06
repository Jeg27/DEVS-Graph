# TODO module comments

from .generate_simple_statements import generate_file_definition, cadmium_namespace


def generate_coupled_models(directory_cpp_code, data):
    '''
    Loops through all coupled models and generates the .hpp file for each one.

    Args:
        directory_cpp_code (str):   The output directory to place the .hpp files.
        data (dict):                The DEVSMap json data that has been sorted into a dictionary.
    '''
    number_of_coupled_models = len(data['coupled_models'])
    code = []

    for i in range(number_of_coupled_models):
        coupled_entry = data['coupled_models'][i]
        coupled_filename = coupled_entry["filename"]                  # e.g. step_gen_ef_coupled.json
        coupled_json = coupled_entry["json"]

        coupled_model_name = coupled_filename.removesuffix("_coupled.json")   # e.g. step_gen_ef
        coupled_model_key = list(coupled_json.keys())[0]                      # e.g. step_coupled
        coupled_model = coupled_json[coupled_model_key]

        code.append(generate_coupled_model(directory_cpp_code, coupled_model_name, coupled_model))

    return code


def generate_coupled_model(directory, coupled_model_name, coupled_model):
    '''
    Creates a .hpp file in directory, and generates the C++ code for the coupled model within that file.

    Args:
        directory (str):            The output directory to place the .hpp file.
        coupled_model_name (str):   The name of the coupled model, which will also be the name of the .hpp file.
        coupled_model (dict):       The DEVSMap data of the coupled model to generate the C++ code from.
    '''
    # output_filepath = directory + coupled_model_name + '.hpp'
    # with open(output_filepath, 'w') as file:
    #     file.write(generate_file_definition(coupled_model_name))
    #     file.write(include_cadmium_coupled())
    #     file.write(include_component_models(coupled_model))
    #     file.write(cadmium_namespace())
    #     file.write(generate_coupled_model_struct(coupled_model_name, coupled_model))
    #     file.write('#endif')
    # file.close()  
    file_name = coupled_model_name.lower() + ".hpp" # may need to add "include/" at the beginning depending on the implementation
    file_content = generate_file_definition(coupled_model_name)
    file_content += include_cadmium_coupled()
    file_content += include_component_models(coupled_model)
    file_content += cadmium_namespace()
    file_content += generate_coupled_model_struct(coupled_model_name, coupled_model)
    file_content += '#endif'
    return {file_name: file_content}

    
    
def include_cadmium_coupled():
    '''
    Returns the C++ statement to include Cadmium's C++ definition of a coupled model.
    '''
    return '#include "cadmium/modeling/devs/coupled.hpp"\n'


def get_components(coupled_model):
    '''
    Returns the component data of model. This corresponds to all of the atomic models 
    that are directly encapsulated by this coupled model.

    Args:
        coupled_model (dict):   The coupled model that is currently being generated.
    '''
    return coupled_model['components']


def include_component_models(coupled_model):
    '''
    Returns the C++ include statements for all atomic models that are directly encapsulated
    by coupled_model.

    Args:
        coupled_model (dict):   The coupled model that is currently being generated.
    '''
    components = get_components(coupled_model)
    include_statements = ""
    for component in components:
        include_statements += '#include "' + component["model"].lower() + '.hpp"\n'
    include_statements += '\n'
    return include_statements


def normalize_cpp_type(data_type):
    '''
    Returns the appropriate C++ datatype for Cadmium port declarations.
    '''
    if data_type == "string":
        return "std::string"
    return data_type


def generate_port_declarations(model):
    '''
    Returns the public port declarations for the coupled model.
    Cadmium coupled models may declare input ports (x) and output ports (y).
    '''
    declarations = ''

    x_ports = model.get('x', {})
    y_ports = model.get('y', {})

    if len(x_ports) == 0 and len(y_ports) == 0:
        return declarations

    declarations += '\tpublic:\n'

    # input ports
    if len(x_ports) > 0:
        declarations += '\t//input ports\n'
        for port_name, data_type in x_ports.items():
            declarations += '\tPort<' + normalize_cpp_type(data_type) + '> ' + port_name + ';\n'

    # output ports
    if len(y_ports) > 0:
        declarations += '\n\t//output ports\n'
        for port_name, data_type in y_ports.items():
            declarations += '\tPort<' + normalize_cpp_type(data_type) + '> ' + port_name + ';\n'

    declarations += '\n'
    return declarations


def generate_port_initializations(model):
    '''
    Returns the constructor code that initializes the coupled model ports.
    '''
    initializations = ''

    x_ports = model.get('x', {})
    y_ports = model.get('y', {})

    # input ports
    if len(x_ports) > 0:
        initializations += '\t\t//input ports\n'
        for port_name, data_type in x_ports.items():
            initializations += (
                '\t\t' + port_name + ' = addInPort<' + normalize_cpp_type(data_type) + '>("' + port_name + '");\n'
            )

    # output ports
    if len(y_ports) > 0:
        if len(initializations) > 0:
            initializations += '\n'
        initializations += '\t\t//output ports\n'
        for port_name, data_type in y_ports.items():
            initializations += (
                '\t\t' + port_name + ' = addOutPort<' + normalize_cpp_type(data_type) + '>("' + port_name + '");\n'
            )

    if len(initializations) > 0:
        initializations += '\n'

    return initializations


def generate_eic_statements(model):
    '''
    Returns addCoupling statements for EICs.
    EIC form: addCoupling(coupled_input_port, component->input_port);
    '''
    statements = ''
    for coupling in model.get('eic', []):
        statements += (
            '\t\taddCoupling('
            + coupling['port_from']
            + ', '
            + coupling['component_to']
            + '->'
            + coupling['port_to']
            + ');\n'
        )
    return statements


def generate_eoc_statements(model):
    '''
    Returns addCoupling statements for EOCs.
    EOC form: addCoupling(component->output_port, coupled_output_port);
    '''
    statements = ''
    for coupling in model.get('eoc', []):
        statements += (
            '\t\taddCoupling('
            + coupling['component_from']
            + '->'
            + coupling['port_from']
            + ', '
            + coupling['port_to']
            + ');\n'
        )
    return statements


def generate_ic_statements(model):
    '''
    Returns addCoupling statements for ICs.
    IC form: addCoupling(component_from->output_port, component_to->input_port);
    '''
    statements = ''
    for coupling in model.get('ic', []):
        statements += (
            '\t\taddCoupling('
            + coupling['component_from']
            + '->'
            + coupling['port_from']
            + ', '
            + coupling['component_to']
            + '->'
            + coupling['port_to']
            + ');\n'
        )
    return statements


def generate_coupled_model_struct(model_name, model):
    '''
    Returns the C++ struct for a coupled model in Cadmium. The struct contains component declarations 
    and internal coupling between the coupled model's atomic models.

    Args:
        model_name (str):   The name of the coupled model being generated.
        model (dict):       The data of the coupled model being generated.
    '''
    constructor = ''
    
    # struct header
    constructor += 'struct ' + model_name + ' : public Coupled {\n\n'

    # declare input and output ports of the coupled model
    constructor += generate_port_declarations(model)

    constructor += '\t' + model_name + '(const std::string& id) : Coupled(id) {\n'

    # initialize coupled model ports
    constructor += generate_port_initializations(model)

    # addComponent statements
    components = get_components(model)
    component_statements = ''
    for component in components:
        component_model_name = component["model"]
        model_id = component["id"]
        component_statements += ('\t\tauto ' + model_id +' = addComponent<' + component_model_name +'>("' + model_id + '");\n')
    constructor += component_statements + '\n'
        
    # addCoupling statements
    # EIC
    constructor += generate_eic_statements(model)

    # EOC
    constructor += generate_eoc_statements(model)

    # IC
    constructor += generate_ic_statements(model)
    
    # close struct
    constructor += '\t}\n};\n\n'
    
    return constructor