# TODO module comments
# Functions for reading the input JSON files, and organizing them into data structures

# TODO currently not implemented: definiton files, param file, metadata file

import json
import os
import glob

def validate_DEVSMap_keys(data: dict) -> dict:
    suffixes = ["_atomic.json", "_coupled.json", "_experiment.json", "_init_state.json"]
    counts = {s: 0 for s in suffixes}

    for key in data.keys():
        for suffix in suffixes:
            if key.endswith(suffix):
                counts[suffix] += 1
    print(counts)
    return counts["_atomic.json"] > 0 and counts["_coupled.json"] > 0 and counts["_experiment.json"] == 1 and counts["_init_state.json"] >= 1

def check_file_counts(directory):
    '''
    Returns true if the file counts are valid based on the DEVSMap specification.
    This means that there is at least one atomic model, at least one coupled model, 
    exactly 1 experiment file, and exactly 1 init_state file.

    Args:
        directory (str):    The directory where the json files are located.
    '''
    # One or more required
    has_atomic = False
    has_coupled = False
    # Specific number required
    experiment_filecount = 0
    init_states_filecount = 0

    for filename in os.listdir(directory):
        full_path = os.path.join(directory, filename)
        if os.path.isfile(full_path):

            if filename.endswith("_atomic.json"):
                has_atomic = True
            if filename.endswith("_coupled.json"):
                has_coupled = True
            if filename.endswith("_experiment.json"):
                experiment_filecount += 1
            if filename.endswith("_init_state.json"):
                init_states_filecount += 1

    valid_fileset = has_atomic and has_coupled and experiment_filecount == 1 and init_states_filecount == 1

    if not valid_fileset:
        #TODO handle this case after working on GUI
        print("Invalid fileset.")

    return valid_fileset


def clean_output_directory(main_directory, include_directory='include'):
    main_cpp_path = os.path.join(main_directory, 'main.cpp')
    
    # Delete main.cpp
    if os.path.isfile(main_cpp_path):
        os.remove(main_cpp_path)
        print(f"Deleted: {main_cpp_path}")
    else:
        print("main.cpp not found.")

    # Change this if there is ever a need for embedded systems with 
    # a different file structure
    include_path = os.path.join(main_directory, include_directory)

    # Delete all .hpp files in the subdirectory
    if os.path.isdir(include_path):
        hpp_files = glob.glob(os.path.join(include_path, '*.hpp'))
        for hpp_file in hpp_files:
            os.remove(hpp_file)
            print("Deleted: " + hpp_file)
    else:
        print("Subdirectory '" + include_directory +"' not found.")


def read_json_files(directory):
    '''
    Returns the raw data read in from the DEVSMap json files as a dictionary.

    Args:
        directory (str):    The directory where the json files are located.
    '''
    temp_data = {}
    for filename in os.listdir(directory):
        if filename.endswith(".json"):
            file_path = os.path.join(directory, filename)
            with open(file_path, 'r') as file:
                try: 
                    data = json.load(file)
                    temp_data[filename] = data
                except json.JSONDecodeError as e:
                    print(f"Error decoding JSON in file {filename}: {e}")
    return temp_data


def sort_json_files(json_data):
    '''
    Returns a dictionary of DEVSMap data sorted by the filename suffix 
    (the type of DEVSMap file).

    Args:
        json_data (dict):   The raw data read in from the DEVSMap json files. This data is 
                            obtained via the read_json_files(directory) function.
    '''
    data = {
        'atomic_models': [],    # 1 or more atomic models
        'coupled_models': [],   # 1 or more coupled models
        'experiment': None,     # exactly 1 experiment file
        'definition': [],       # 0 or more definition files
        'init_states': [],      # 1 or more init_state files
        'param': None,          # exactly 0 or exactly 1 param files
        'metadata': None        # exactly 0 or exactly 1 metadata files
    }

    for key, value in json_data.items():
        if key.endswith("_atomic.json"):
            data["atomic_models"].append({
                "filename": key,
                "json": value
            })

        elif key.endswith("_coupled.json"):
            data["coupled_models"].append({
                "filename": key,
                "json": value
            })

        elif key.endswith("_experiment.json"):
            data["experiment"] = value

        elif key.endswith("_init_state.json"):
            data["init_states"].append({
                "filename": key,
                "init_states": value.get("init_states", {})
            })

        else:
            print(f"Parsing for {key} not yet implemented.\n")

    return data