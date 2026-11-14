import re
# TODO top of the file comments

def include_limits():
    '''
    Returns the C++ statement to include the 'limits' library.
    '''
    return '#include <limits>\n'


def include_string():
    '''
    Returns the C++ statement to include the 'string' utilities.
    '''
    return '#include <string>\n'

def include_model(model_name):
    '''
    Returns the C++ statement to include a specific DEVS model.

    Args:
        model_name (str):   The name of the DEVS model to include.
    '''
    return '#include "include/' + model_name + '.hpp"\n\n'


def cadmium_namespace():
    '''
    Returns the C++ statement that declares usage of the 'cadmium' namespace.
    '''
    return "using namespace cadmium;\n\n"


def generate_file_definition(model_name): 
    '''
    Returns C++ statements to define MODEL_NAME_HPP and prevent the redefintion of it.

    Args:
        model_name (str):   The name of the model being defined, which is the current 
                            atomic or coupled model file being generated
    '''
    model_definition_name = model_name.upper() + "_HPP"
    return "#ifndef "+ model_definition_name + "\n#define " + model_definition_name + "\n\n"  


def infinity():
    '''
    Returns the C++ syntax for infinity that is compatible with Cadmium.
    '''
    return 'std::numeric_limits<double>::infinity()'


def replace_inf(text):
    '''
    Replaces every stand-alone 'inf' in the text parameter with the appropriate
    C++ syntax for infinity. Only the whole word is replaced, so names that
    contain "inf" (such as info or infected) are left alone, as are member
    accesses (x.inf) and the string literal "inf".

    Args:
        text (str):     The text to search and replace 'inf' with
                        'std::numeric_limits<double>::infinity()'
    '''
    return re.sub(r'(?<![\w."])inf(?![\w"])', infinity(), text)



def get_simulation_time_in_seconds(experiment_file):
    '''
    Returns the number of seconds that the Cadmium simulation will run for.

    Args:
        experiment_file (str):  The data corresponding to the 'XYZ_experiment.json' file, 
                                where XYZ is the name of the top DEVS model.
    '''
    return experiment_file['time_span']


def get_top_model_name(experiment_file):
    '''
    Returns the name of the top DEVS model.

    Args:
        experiment_file (str):  The data corresponding to the 'XYZ_experiment.json' file, 
                                where XYZ is the name of the top DEVS model.
    '''
    return experiment_file['model_under_test']['model'].removesuffix("_coupled.json")


def get_top_model(data, top_model_name):
    '''
    Returns the data of the top model.

    Args:
        data (dict):            The data of all of the json files, read in by the function 
                                read_json_files(directory), and sorted by the function 
                                sort_json_files(json_data).
        top_model_name (str):   The name of the top DEVS model.
    '''
    return data['coupled_models'][0][top_model_name]

