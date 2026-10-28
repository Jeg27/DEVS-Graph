const generalItems = [

  /*
  {
    label: 'State',
    userObject: {
      elementType: "state",
      stateVariables: [
        {
          name: "type",
          type: "string",
          defaultValue: "state"
        },
        {
          name: "custom",
          type: "string",
          defaultValue: "example"
        }
      ]
    },
    width: 75,
    height: 75,
    style: DEFAULT_STYLES.state
  },
  */

  /*
  {
    label: 'counter_system',
    userObject: {
      elementType: 'coupledModel',
      model_name: 'counter_system',
      unique_id: 'counter_system',
      json: {
        model: {
          x: {},
          y: {
            count: 'int'
          },
          components: {},
          eic: [],
          eoc: [
            {
              port_from: 'count_out',
              port_to: 'count',
              component_from: 'counter_model'
            }
          ],
          ic: [
            {
              port_from: 'bool_out',
              port_to: 'direction_in',
              component_to: 'counter_model',
              component_from: 'direction_generator'
            },
            {
              port_from: 'int_out',
              port_to: 'increment_in',
              component_to: 'counter_model',
              component_from: 'increment_generator'
            }
          ]
        },
        include_sets: ["default_sets.json"],
      },
    },
    width: 120,
    height: 60,
    style: DEFAULT_STYLES.coupledModel
  },
  */

  {
    label: 'counter_model : counter',
    userObject: {
      elementType: 'atomicModel',
      model_name: 'counter',
      unique_id: 'counter_model',
      json: {
        model: {
          x: {
            increment_in: 'int',
            direction_in: 'bool'
          },
          y: {
            count_out: 'int'
          },
          s: {
            sigma: { data_type: 'double', init_state: 'inf' },
            count: { data_type: 'int', init_state: '0' },
            increment: { data_type: 'int', init_state: '1' },
            countUp: { data_type: 'bool', init_state: 'true' }
          },
          delta_int: {
            "countUp == true": {
              "count": "count + increment",
              "sigma": "inf"
            },
            "countUp == false": {
              "count": "count - increment",
              "sigma": "inf"
            },
            "otherwise": {}
          },
          delta_ext: {
            "increment_in.bagSize() != 0 && direction_in.bagSize() == 0": {
              "increment": "increment_in.bag(-1)",
              "sigma": "0.1"
            },
            "direction_in.bagSize() != 0 && increment_in.bagSize() == 0": {
              "countUp": "direction_in.bag(-1)",
              "sigma": "0.1"
            },
            "otherwise": {
              "increment": "increment_in.bag(-1)",
              "countUp": "direction_in.bag(-1)",
              "sigma": "0.1"
            }
          },
          delta_con: {},
          lambda: {
            "otherwise": {
              "count_out": "count"
            }
          },
          ta: { "otherwise": "sigma" }
        },
        include_sets: ["default_sets.json"],
        parameters: {}
      },
    },
    width: 120,
    height: 60,
    style: DEFAULT_STYLES.atomicModel
  },

  /*
  {
    label: 'increment_generator : generator_int',
    userObject: {
      elementType: 'atomicModel',
      model_name: 'generator_int',
      unique_id: 'increment_generator',
      json: {
        model: {
          x: {},
          y: {
            int_out: 'int',
          },
          s: {
            sigma: { data_type: 'double', init_state: '3.0' },
            nextInt: { data_type: 'int', init_state: '1' },
          },
          delta_int: {
            "otherwise": {
              "nextInt": "rand() % 5 + 1"
            }
          },
          delta_ext: {
            "otherwise": {}
          },
          delta_con: {},
          lambda: {
            "otherwise": {
              "int_out": "nextInt"
            }
          },
          ta: {
            "otherwise": "sigma"
          }
        },
        include_sets: ["default_sets.json"],
        parameters: {}
      },
    },
    width: 120,
    height: 60,
    style: DEFAULT_STYLES.atomicModel
  },
  */

  {
    label: 'direction_generator : generator_bool',
    userObject: {
      elementType: 'atomicModel',
      model_name: 'generator_bool',
      unique_id: 'direction_generator',
      json: {
        model: {
          x: {},
          y: {
            bool_out: 'bool'
          },
          s: {
            sigma: { data_type: 'double', init_state: '13.0' },
            nextBool: { data_type: 'bool', init_state: 'false' }
          },
          delta_int: {
            "otherwise": {
              "nextBool": "!nextBool"
            }
          },
          delta_ext: { "otherwise": {} },
          delta_con: {},
          lambda: {
            "otherwise": {
              "bool_out": "nextBool"
            }
          },
          ta: { "otherwise": "sigma" }
        },
        include_sets: ["default_sets.json"],
        parameters: {}
      },
    },
    width: 120,
    height: 60,
    style: DEFAULT_STYLES.atomicModel
  },

  
  {
    label: 'light_1 : traffic_light',
    userObject: {
      elementType: 'atomicModel',
      model_name: 'traffic_light',
      unique_id: 'light_1',
      json: {
        model: {
          x: {},
          y: {
            colour_out: 'string',
          },
          s: {
            sigma: { data_type: "double", init_state: "5.0" },
            colour: { data_type: "string", init_state: '"RED"' },
          },
          delta_int: {
            'colour == "RED"': {
              "colour": '"GREEN"',
              "sigma": "7"
            },
            'colour == "GREEN"': {
              "colour": '"YELLOW"',
              "sigma": "3"
            },
            "otherwise": {
              "colour": '"RED"',
              "sigma": "10"
            }
          },
          delta_ext: { "otherwise": {} },
          delta_con: {},
          lambda: {
            "otherwise": {
              "colour_out": "colour"
            }
          },
          ta: { "otherwise": "sigma" }
        },
        include_sets: ["default_sets.json"],
        parameters: {}
      },
    },
    width: 120,
    height: 60,
    style: DEFAULT_STYLES.atomicModel
  },
  


  // =========================
  // NEW COUNTER EXPERIMENT ITEMS
  // =========================

  {
    label: 'step_generator : step_generator',
    userObject: {
      elementType: 'atomicModel',
      model_name: 'step_generator',
      unique_id: 'step_gen',
      json: {
        model: {
          x: {},
          y: {
            step_out: 'int'
          },
          s: {
            sigma: { data_type: 'double', init_state: '2' },
            step: { data_type: 'int', init_state: '5' }
          },
          delta_int: {
            "otherwise": {}
          },
          delta_ext: {
            "otherwise": {}
          },
          delta_con: {},
          lambda: {
            "otherwise": {
              "step_out": "step"
            }
          },
          ta: {
            "otherwise": "sigma"
          }
        },
        include_sets: ["default_sets.json"],
        parameters: {}
      },
    },
    width: 120,
    height: 60,
    style: DEFAULT_STYLES.atomicModel
  },

  {
    label: 'exponential_addition_generator : exponential_addition',
    userObject: {
      elementType: 'atomicModel',
      model_name: 'exponential_addition',
      unique_id: 'exponential_addition_generator',
      json: {
        model: {
          x: {},
          y: {
            step_out: 'int'
          },
          s: {
            sigma: { data_type: 'double', init_state: '2' },
            baseValue_x: { data_type: 'int', init_state: '2' },
            powerValue_y: { data_type: 'int', init_state: '3' },
            output: { data_type: 'int', init_state: '0' }
          },
          delta_int: {
            "otherwise": {
              "output": "baseValue_x + powerValue_y + 1",
              "powerValue_y": "powerValue_y + 1"
            }
          },
          delta_ext: {
            "otherwise": {}
          },
          delta_con: {},
          lambda: {
            "otherwise": {
              "step_out": "output"
            }
          },
          ta: {
            "otherwise": "sigma"
          }
        },
        include_sets: ["default_sets.json"],
        parameters: {}
      },
    },
    width: 120,
    height: 60,
    style: DEFAULT_STYLES.atomicModel
  }
];

const genericItems = [
  {
    label: 'Generic Atomic',
    userObject: {
      elementType: 'atomicModel',
      model_name: 'name',
      unique_id: 'id',
      json: {
        model: {
          x: {},
          y: {},
          s: {
            sigma: { data_type: 'double', init_state: 'inf' }
          },
          delta_int: {
            "otherwise": {}
          },
          delta_ext: {
            "otherwise": {}
          },
          delta_con: {},
          lambda: {
            "otherwise": {}
          },
          ta: { "otherwise": "sigma" }
        },
        include_sets: ["default_sets.json"],
        parameters: {}
      },
    },
    width: 120,
    height: 60,
    style: DEFAULT_STYLES.atomicModel
  },
];

const coupledTemplate = [
  // DO NOT DELETE
  // This is a reference for development of the tool
  {
    label: 'Generic Coupled',
    userObject: {
      elementType: 'coupledModel',
      model_name: 'name',
      unique_id: 'id',
      json: {
        model: {
          x: {},
          y: {},
          components: [],
          eic: [],
          eoc: [],
          ic: []
        },
        include_sets: ["default_sets.json"],
      },
    },
    width: 120,
    height: 60,
    style: DEFAULT_STYLES.coupledModel
  }
]

const counterItems = [
  ...genericItems,
  ...generalItems
];