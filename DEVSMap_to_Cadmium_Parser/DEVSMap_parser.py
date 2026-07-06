'''
DEVSMap Parser
'''

import json
from .parser_reading_files import *
from .generate_main_cpp import *
from .generate_coupled_model_hpp import *
from .generate_atomic_model_hpp import *
from .generate_simple_statements import *
from .generate_experiment_main_cpp import generate_experiment_main_cpp

def clean_control_chars(s: str) -> str:
    """
    Remove disallowed JSON control characters from string s.
    Allowed control chars in JSON strings are:
    \b (0x08), \f (0x0C), \n (0x0A), \r (0x0D), \t (0x09).
    
    All others in range 0x00-0x1F will be removed.
    """
    # Build regex pattern matching disallowed control chars
    # Allowed: \x08 \x09 \x0A \x0C \x0D
    pattern = r'[\x00-\x07\x0B\x0E-\x1F]'
    
    cleaned = re.sub(pattern, '', s)
    return cleaned

def build_effective_init_states(experiment_data, init_state_entries):
    """
    Resolve the correct init-state files for this run using experiment.json.
    Returns one combined init-state dict for downstream atomic generation.
    """

    effective = {}

    # Which init files are needed for this run?
    wanted_files = []

    mut_init_file = experiment_data.get("model_under_test", {}).get("initial_state", "")
    if mut_init_file:
        wanted_files.append(mut_init_file)

    ef_block = experiment_data.get("experimental_frame", {})
    if isinstance(ef_block, dict):
        ef_init_file = ef_block.get("initial_state", "")
        if ef_init_file:
            wanted_files.append(ef_init_file)

    # Pull only the referenced init files
    for wanted in wanted_files:
        match = next((entry for entry in init_state_entries if entry["filename"] == wanted), None)
        if match is None:
            raise ValueError(f"Init-state file not found in bundle: {wanted}")

        init_block = match.get("init_states", {})
        if not isinstance(init_block, dict):
            raise ValueError(f"Invalid init_states structure in file: {wanted}")

        effective.update(init_block)

    return effective


def generate_code(JSON):
    #print("TYPE IS: " + str(type(JSON))) # may need later when actually hooking up everything
    #DEVSMap = json.loads(JSON)
    DEVSMap = JSON #TODO temporarily silly reassignment
    #fix this for if-else when adding based on files
    if validate_DEVSMap_keys(DEVSMap):
        # print(DEVSMap)
        code = {}

        data = sort_json_files(DEVSMap) 
        # print("--------DEVSMap--------")
        # print(data)
        

        dump_dir = "DEVSMap_to_Cadmium_Parser/JSON"

        for filename, content in DEVSMap.items():
            if filename.endswith(".json"):
                with open(f"{dump_dir}/{filename}", "w", encoding="utf-8") as f:
                    json.dump(content, f, indent=2)

        print(f"Saved received JSON files to {dump_dir}")

        simulation_time = get_simulation_time_in_seconds(data['experiment'])
        top_model_name = get_top_model_name(data['experiment'])
        #top_model = get_top_model(data, top_model_name) # not needed??
        
        directory_code_include_output = "directory_code_include_output" #remove after
        
        experiment_data = data['experiment']

        data["init_states"] = build_effective_init_states(
            experiment_data,
            data["init_states"]
        )

        print("RESOLVED INIT STATES:", data["init_states"])

        ef = experiment_data.get("experimental_frame", {})
        is_real_experiment = isinstance(ef, dict) and bool(ef.get("model"))
        print("EF =", ef)
        print("MODEL =", ef.get("model"))
        print("TYPE =", type(ef.get("model")))
        print("real?", isinstance(ef, dict), bool(ef.get("model")))
        # Finally, we can generate the code for the main.cpp file, and each of 
        # the atomic and coupled models.

        # Generate the correct main.cpp
        if is_real_experiment:
            print("IT's a REAL EXPERIMENT")
            mut_file = experiment_data["model_under_test"]["model"]
            ef_file = experiment_data["experimental_frame"]["model"]

            mut_uid = mut_file.removesuffix("_coupled.json")
            ef_uid = ef_file.removesuffix("_coupled.json")

            mut_model_name = list(DEVSMap[mut_file].keys())[0]
            ef_model_name = list(DEVSMap[ef_file].keys())[0]

            cpic = experiment_data.get("cpic", [])
            pocc = experiment_data.get("pocc", [])
            simulation_time = experiment_data.get("time_span", "30")

            code.update(
                generate_experiment_main_cpp(
                    mut_uid,
                    ef_uid,
                    cpic,
                    pocc,
                    simulation_time
                )
            )
        else:
            print("sent to regular main.cpp generator",top_model_name, simulation_time)
            code.update(generate_main_cpp(top_model_name, simulation_time))
        
        # Generate the atomic and coupled model HPPs as usual. 
        for coupled_model in generate_coupled_models(directory_code_include_output, data):
            code.update(coupled_model)
        for atomic_model in generate_atomic_models(directory_code_include_output, data):
            code.update(atomic_model)

        print("Received bundle files:", DEVSMap.keys())
        
        #print("--------CODE--------")
        #print(code)
        return json.dumps(code)


# ############################################################################
# # To use this parser, we must only set the input and output directories.

# # Set the input directory containing the DEVSMap json files
# # These are the files that will be parsed and converted to Cadmium code.
# directory_json_input = './input/'

# # Set the desired output directory
# # This should be the "main" directory in a Cadmium project, because
# # the parser will place the main.cpp files into the "main" directory,
# # and the atomic/coupled model files into the "main/include" directory.
# directory_code_main_output = './output/main/'

# ############################################################################
# # The remaining instructions are to run the parser, and no changes are 
# # required by the user

# # First, we construct the output filepath for the atomic/coupled models
# directory_code_include_output = directory_code_main_output + 'include/'

# # Next, we check that we have a valid set of input files.  This will check 
# # that we have exactly one init_state.json file, exactly one experiment.json 
# # file, at least one coupled.json file, and at least one atomic.json file.
# if check_file_counts(directory_json_input):

#     # If the json input files are a valid set of DEVSMap files, we will clean 
#     # the main and main/include directory of the previously generated files.
#     # This deletes the existing main.cpp file from the main directory, and 
#     # deletes all of the atomic and coupled model .hpp files from the 
#     # main/include directory.
#     clean_output_directory(directory_code_main_output)

#     # Next, we read the JSON files, and parse them into a Python dictionary 
#     # that contains a list for each type of file. For example, 
#     # "data['atomic_models']" will contain a list where each index holds 
#     # the data for one atomic model).
#     raw_data = read_json_files(directory_json_input)
#     data = sort_json_files(raw_data) 

#     # Then, we obtain some key information such as the number of seconds
#     # the simulation will run for, and obtain the name and data of the 
#     # top model.
#     simulation_time = get_simulation_time_in_seconds(data['experiment'])
#     top_model_name = get_top_model_name(data['experiment'])
#     top_model = get_top_model(data, top_model_name)

#     # Finally, we can generate the code for the main.cpp file, and each of 
#     # the atomic and coupled models.
#     generate_main_cpp(directory_code_main_output, top_model_name, simulation_time)
#     generate_coupled_models(directory_code_include_output, data)
#     generate_atomic_models(directory_code_include_output, data)


# ############################################################################
# # The following are suggested print statements for debugging

# #print(data)
# #print(data['atomic_models'])
# #print(data['coupled_models'])
# #print(data['experiment'])
# #print(data['definition'])
# #print(data['init_states'])
# #print(data['param'])
# #print(data['metadata'])

# #print(data['atomic_models'][1]) 
# #print(top_model)
