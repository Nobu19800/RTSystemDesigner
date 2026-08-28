import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  MarkerType,
  ConnectionMode,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';

import RTCNode from './RTCNode';

import type {
  RTCNodeData,
  RTCPort,
  RTCServicePort,
  RTCServiceInterface,
  RTCDeployment,
  RTCConf,
  RTCImplementationSpec,
} from './rtcTypes';

import './App.css';


/* =========================================================
 * React Flow Node Types
 * ========================================================= */

const API_BASE_URL =
  'https://rt-session-server.rtsystem-designer-web.workers.dev';

const nodeTypes = {
  rtc: RTCNode,
};


/* =========================================================
 * RTC Template
 * ========================================================= */

type RTCTemplate =
  Omit<
    RTCNodeData,
    'instanceName' | 'state'
  >;


/* =========================================================
 * Session
 * ========================================================= */

type RTCSession = {
  id?: string;

  name?: string;

  description?: string;

  rtcTemplates: RTCTemplate[];

  nodes?: Node[];

  edges?: Edge[];

  createdAt?: string;

  updatedAt?: string;
};


const initialNodes: Node[] = [];

const initialEdges: Edge[] = [];


/* =========================================================
 * Default Deployment
 * ========================================================= */

function createDefaultDeployment():
  RTCDeployment {

  return {
    host: 'localhost',

    executable: '',

    workingDirectory: '',

    arguments: '',

    environment: '',
  };
}


/* =========================================================
 * Default rtc.conf
 * ========================================================= */

function createDefaultRTCConf():
  RTCConf {

  return {
    corbaNameServers: 'localhost',

    managerShutdownAuto: 'NO',
  };
}


/* =========================================================
 * Default Implementation
 * ========================================================= */

function createDefaultImplementation():
  RTCImplementationSpec {

  return {
    summary: '',

    requirements: '',

    constraints: '',

    notes: '',
  };
}


/* =========================================================
 * Service Interface matching
 * ========================================================= */

function findMatchingServiceInterfaces(
  portA: RTCServicePort,
  portB: RTCServicePort,
) {

  const matches: {
    name: string;

    interfaceType: string;

    direction:
      | 'A_TO_B'
      | 'B_TO_A';
  }[] = [];


  /*
   * A Consumer -> B Provider
   */

  for (
    const consumer
    of portA.interfaces
  ) {

    if (
      consumer.polarity !==
      'consumer'
    ) {
      continue;
    }


    for (
      const provider
      of portB.interfaces
    ) {

      if (
        provider.polarity !==
        'provider'
      ) {
        continue;
      }


      if (
        consumer.name ===
          provider.name
        &&
        consumer.interfaceType ===
          provider.interfaceType
      ) {

        matches.push({
          name:
            consumer.name,

          interfaceType:
            consumer.interfaceType,

          direction:
            'A_TO_B',
        });

      }

    }

  }


  /*
   * B Consumer -> A Provider
   */

  for (
    const consumer
    of portB.interfaces
  ) {

    if (
      consumer.polarity !==
      'consumer'
    ) {
      continue;
    }


    for (
      const provider
      of portA.interfaces
    ) {

      if (
        provider.polarity !==
        'provider'
      ) {
        continue;
      }


      if (
        consumer.name ===
          provider.name
        &&
        consumer.interfaceType ===
          provider.interfaceType
      ) {

        matches.push({
          name:
            consumer.name,

          interfaceType:
            consumer.interfaceType,

          direction:
            'B_TO_A',
        });

      }

    }

  }


  return matches;
}


/* =========================================================
 * Find Port
 * ========================================================= */

function findPort(
  nodes: Node[],
  nodeId: string,
  handleId: string,
): RTCPort | undefined {

  const node =
    nodes.find(
      (currentNode) =>
        currentNode.id === nodeId
    );


  if (!node) {
    return undefined;
  }


  const data =
    node.data as RTCNodeData;


  return data.ports.find(
    (port) =>
      port.id === handleId
  );
}


/* =========================================================
 * RTC Editor
 * ========================================================= */

function RTCEditor() {

  /* -------------------------------------------------------
   * React Flow State
   * ------------------------------------------------------- */

  const [
    nodes,
    setNodes,
    onNodesChange,
  ] =
    useNodesState(
      initialNodes
    );


  const [
    edges,
    setEdges,
    onEdgesChange,
  ] =
    useEdgesState(
      initialEdges
    );


  /* -------------------------------------------------------
   * Session
   * ------------------------------------------------------- */

  const [
    sessionId,
    setSessionId,
  ] =
    useState<string | null>(
      null
    );


  const [
    sessionName,
    setSessionName,
  ] =
    useState<string | null>(
      null
    );


  const [
    rtcTemplates,
    setRtcTemplates,
  ] =
    useState<RTCTemplate[]>(
      []
    );


  const [
    rtcCount,
    setRtcCount,
  ] =
    useState(1);


  const [
    showRTCDialog,
    setShowRTCDialog,
  ] =
    useState(false);


  const [
    sessionLoading,
    setSessionLoading,
  ] =
    useState(false);


  const [
    sessionError,
    setSessionError,
  ] =
    useState<string | null>(
      null
    );


  /* -------------------------------------------------------
   * Selected RTC
   * ------------------------------------------------------- */

  const [
    selectedNodeId,
    setSelectedNodeId,
  ] =
    useState<string | null>(
      null
    );


  /* -------------------------------------------------------
   * Property Tab
   * ------------------------------------------------------- */

  const [
    propertyTab,
    setPropertyTab,
  ] =
    useState<
      | 'general'
      | 'deployment'
      | 'configuration'
      | 'ports'
      | 'implementation'
    >(
      'general'
    );


  const {
    screenToFlowPosition,
  } =
    useReactFlow();


  /* =======================================================
   * Selected Node
   * ======================================================= */

  const selectedNode =
    nodes.find(
      (node) =>
        node.id ===
        selectedNodeId
    );


  const selectedRTC =
    selectedNode
      ? selectedNode.data as RTCNodeData
      : null;


  /* =======================================================
   * Session Load
   * ======================================================= */

  useEffect(
    () => {

      const params =
        new URLSearchParams(
          window.location.search
        );


      const id =
        params.get(
          'session'
        );


      if (!id) {

        setSessionId(
          null
        );

        setSessionName(
          null
        );

        setRtcTemplates(
          []
        );

        setSessionError(
          null
        );

        return;
      }


      if (!id) {

        setSessionId(
          null
        );

        setSessionError(
          'Sessionが指定されていません。'
        );

        return;
      }

      setSessionId(
        id
      );


      async function loadSession(
        sessionId: string
        ) {

        try {

          setSessionLoading(
            true
          );

          setSessionError(
            null
          );


          const response =
            await fetch(
              `${API_BASE_URL}/api/sessions/${encodeURIComponent(sessionId)}`
            );


          if (!response.ok) {

            throw new Error(
              `Sessionの取得に失敗しました (${response.status})`
            );

          }


          const session:
            RTCSession =
              await response.json();


          if (
            !Array.isArray(
              session.rtcTemplates
            )
          ) {

            throw new Error(
              'SessionにrtcTemplatesがありません'
            );

          }


          /*
           * 古いSessionでも動作するように
           * deployment / rtcConf /
           * configuration / implementation
           * を補完する
           */

          const templates =
            session.rtcTemplates.map(
              (template) => ({

                ...template,

                deployment:
                  template.deployment ??
                  createDefaultDeployment(),

                rtcConf:
                  template.rtcConf ??
                  createDefaultRTCConf(),

                configuration:
                  template.configuration ??
                  [],

                implementation:
                  template.implementation ??
                  createDefaultImplementation(),

              })
            );


          setRtcTemplates(
            templates
          );


          setSessionName(
            session.name ??
            id
          );


          /*
           * 保存済みNodes
           */

          if (
            Array.isArray(
              session.nodes
            )
          ) {

            const loadedNodes =
              session.nodes.map(
                (node) => {

                  const data =
                    node.data as RTCNodeData;


                  return {

                    ...node,

                    data: {

                      ...data,

                      deployment:
                        data.deployment ??
                        createDefaultDeployment(),

                      rtcConf:
                        data.rtcConf ??
                        createDefaultRTCConf(),

                      configuration:
                        data.configuration ??
                        [],

                      implementation:
                        data.implementation ??
                        createDefaultImplementation(),

                    },

                  };

                }
              );


            setNodes(
              loadedNodes
            );

          }


          /*
           * 保存済みEdges
           */

          if (
            Array.isArray(
              session.edges
            )
          ) {

            setEdges(
              session.edges
            );

          }

        }
        catch (error) {

          console.error(
            error
          );


          if (
            error instanceof Error
          ) {

            setSessionError(
              error.message
            );

          }
          else {

            setSessionError(
              'Sessionの取得に失敗しました'
            );

          }

        }
        finally {

          setSessionLoading(
            false
          );

        }

      }


      loadSession(
        id
      );

    },

    [
      setNodes,
      setEdges,
    ],
  );


  /* =======================================================
   * Connection Validation
   * ======================================================= */

  const isValidConnection =
    useCallback(
      (
        connection:
          Edge | Connection
      ): boolean => {

        if (
          connection.sourceHandle ==
            null
          ||
          connection.targetHandle ==
            null
        ) {

          return false;

        }


        if (
          connection.source ===
          connection.target
        ) {

          return false;

        }


        const portA =
          findPort(
            nodes,
            connection.source,
            connection.sourceHandle
          );


        const portB =
          findPort(
            nodes,
            connection.target,
            connection.targetHandle
          );


        if (
          !portA ||
          !portB
        ) {

          return false;

        }


        /*
         * DataPort
         */

        if (
          portA.portType ===
            'data'
          &&
          portB.portType ===
            'data'
        ) {

          return (
            portA.direction ===
              'out'
            &&
            portB.direction ===
              'in'
          );

        }


        /*
         * ServicePort
         */

        if (
          portA.portType ===
            'service'
          &&
          portB.portType ===
            'service'
        ) {

            /*
            * どちらか一方でも
            * Service Interfaceが未設定なら
            * 接続を許可する
            */

            if (
              portA.interfaces.length === 0
              ||
              portB.interfaces.length === 0
            ) {

              return true;
            }

          return (
            findMatchingServiceInterfaces(
              portA,
              portB
            ).length > 0
          );

        }


        return false;

      },

      [nodes],
    );


  /* =======================================================
   * Connect
   * ======================================================= */

  const onConnect =
    useCallback(
      (
        connection:
          Connection
      ) => {

        if (
          !isValidConnection(
            connection
          )
        ) {

          return;

        }


        if (
          connection.sourceHandle ==
            null
          ||
          connection.targetHandle ==
            null
        ) {

          return;

        }


        const portA =
          findPort(
            nodes,
            connection.source,
            connection.sourceHandle
          );


        const portB =
          findPort(
            nodes,
            connection.target,
            connection.targetHandle
          );


        if (
          !portA ||
          !portB
        ) {

          return;

        }


        /*
         * ServicePort
         */

        if (
          portA.portType ===
            'service'
          &&
          portB.portType ===
            'service'
        ) {

          const matches =
            findMatchingServiceInterfaces(
              portA,
              portB
            );


          setEdges(
            (currentEdges) =>
              addEdge(
                {

                  ...connection,

                  data: {

                    connectionType:
                      'service',

                    interfaces:
                      matches,

                  },

                },

                currentEdges
              )
          );


          return;

        }


        /*
         * DataPort
         */

        setEdges(
          (currentEdges) =>
            addEdge(
              {

                ...connection,

                markerEnd: {

                  type:
                    MarkerType
                      .ArrowClosed,

                },

                data: {

                  connectionType:
                    'data',

                },

              },

              currentEdges
            )
        );

      },

      [
        nodes,
        setEdges,
        isValidConnection,
      ],
    );

    /* =======================================================
 * Create New Empty RTC
 * ======================================================= */

const createNewRTC =
  useCallback(
    () => {

      const id =
        `newrtc-${rtcCount}`;


      const position =
        screenToFlowPosition({
          x:
            window.innerWidth /
            2,

          y:
            window.innerHeight /
            2,
        });


      const offset =
        (
          rtcCount % 5
        ) * 20;


      position.x +=
        offset;

      position.y +=
        offset;


      const nodeData:
        RTCNodeData = {

        name:
          'NewRTC',

        instanceName:
          id,

        state:
          'INACTIVE',

        ports: [

          /*
           * 型未指定 InPort
           */

          {
            id:
              'in',

            name:
              'in',

            portType:
              'data',

            direction:
              'in',

            dataType:
              '',
          },


          /*
           * 型未指定 OutPort
           */

          {
            id:
              'out',

            name:
              'out',

            portType:
              'data',

            direction:
              'out',

            dataType:
              '',
          },


          /*
           * Interface未設定 ServicePort
           */

          {
            id:
              'service',

            name:
              'service',

            portType:
              'service',

            interfaces:
              [],
          },

        ],


        deployment:
          createDefaultDeployment(),


        rtcConf:
          createDefaultRTCConf(),


        configuration:
          [],


        implementation:
          createDefaultImplementation(),

      };


      const newNode:
        Node = {

        id,

        type:
          'rtc',

        position,

        data:
          nodeData,

      };


      setNodes(
        (currentNodes) => [

          ...currentNodes,

          newNode,

        ]
      );


      setRtcCount(
        (count) =>
          count + 1
      );


      /*
       * RTC選択ダイアログを閉じる
       */

      setShowRTCDialog(
        false
      );


      /*
       * 作成直後のRTCを選択
       */

      setSelectedNodeId(
        id
      );


      /*
       * Generalタブを表示
       */

      setPropertyTab(
        'general'
      );

    },

    [
      rtcCount,
      screenToFlowPosition,
      setNodes,
    ],
  );

  /* =======================================================
   * Add RTC
   * ======================================================= */

  const addRTC =
    useCallback(
      (
        template:
          RTCTemplate
      ) => {

        const id =
          `${template.name.toLowerCase()}-${rtcCount}`;


        const position =
          screenToFlowPosition({

            x:
              window.innerWidth /
              2,

            y:
              window.innerHeight /
              2,

          });


        const offset =
          (
            rtcCount % 5
          ) * 20;


        position.x +=
          offset;

        position.y +=
          offset;


        const nodeData:
          RTCNodeData = {

          ...template,

          instanceName:
            id,

          state:
            'INACTIVE',

          deployment:
            template.deployment ??
            createDefaultDeployment(),

          rtcConf:
            template.rtcConf ??
            createDefaultRTCConf(),

          configuration:
            template.configuration ??
            [],

          implementation:
            template.implementation ??
            createDefaultImplementation(),

        };


        const newNode:
          Node = {

          id,

          type:
            'rtc',

          position,

          data:
            nodeData,

        };


        setNodes(
          (currentNodes) => [

            ...currentNodes,

            newNode,

          ]
        );


        setRtcCount(
          (count) =>
            count + 1
        );


        setShowRTCDialog(
          false
        );


        setSelectedNodeId(
          id
        );


        setPropertyTab(
          'general'
        );

      },

      [
        rtcCount,
        screenToFlowPosition,
        setNodes,
      ],
    );


  /* =======================================================
   * Node Click
   * ======================================================= */

  const onNodeClick =
    useCallback(
      (
        _event:
          React.MouseEvent,

        node:
          Node
      ) => {

        setSelectedNodeId(
          node.id
        );

      },

      [],
    );


  /* =======================================================
   * Pane Click
   * ======================================================= */

  const onPaneClick =
    useCallback(
      () => {

        setSelectedNodeId(
          null
        );

      },

      [],
    );


  /* =======================================================
   * Generic RTC Data Update
   * ======================================================= */

  const updateRTCData =
    useCallback(
      (
        nodeId:
          string,

        updater:
          (
            data:
              RTCNodeData
          ) =>
            RTCNodeData
      ) => {

        setNodes(
          (currentNodes) =>
            currentNodes.map(
              (node) => {

                if (
                  node.id !==
                  nodeId
                ) {

                  return node;

                }


                const data =
                  node.data as RTCNodeData;


                return {

                  ...node,

                  data:
                    updater(
                      data
                    ),

                };

              }
            )
        );

      },

      [setNodes],
    );


    /* =======================================================
 * RTC Type Update
 * ======================================================= */

/* =======================================================
 * RTC Type Update
 * ======================================================= */

const updateRTCType =
  useCallback(
    (
      value:
        string
    ) => {

      if (!selectedNodeId) {
        return;
      }


      updateRTCData(
        selectedNodeId,

        (data) => ({

          ...data,

          name:
            value,

          instanceName:
            `${value}0`,

        })
      );

    },

    [
      selectedNodeId,
      updateRTCData,
    ],
  );

  /* =======================================================
   * General Update
   * ======================================================= */

  const updateInstanceName =
    useCallback(
      (
        value:
          string
      ) => {

        if (!selectedNodeId) {
          return;
        }


        updateRTCData(
          selectedNodeId,

          (data) => ({

            ...data,

            instanceName:
              value,

          })
        );

      },

      [
        selectedNodeId,
        updateRTCData,
      ],
    );


  /* =======================================================
   * Deployment Update
   * ======================================================= */

  const updateDeployment =
    useCallback(
      (
        field:
          keyof RTCDeployment,

        value:
          string
      ) => {

        if (!selectedNodeId) {
          return;
        }


        updateRTCData(
          selectedNodeId,

          (data) => ({

            ...data,

            deployment: {

              ...data.deployment,

              [field]:
                value,

            },

          })
        );

      },

      [
        selectedNodeId,
        updateRTCData,
      ],
    );


  /* =======================================================
   * rtc.conf Update
   * ======================================================= */

  const updateRTCConf =
    useCallback(
      (
        field:
          keyof RTCConf,

        value:
          string
      ) => {

        if (!selectedNodeId) {
          return;
        }


        updateRTCData(
          selectedNodeId,

          (data) => ({

            ...data,

            rtcConf: {

              ...data.rtcConf,

              [field]:
                value,

            },

          })
        );

      },

      [
        selectedNodeId,
        updateRTCData,
      ],
    );


    /* =======================================================
 * Create Unique Port ID
 * ======================================================= */

function createUniquePortId(
  ports: RTCPort[],
  baseName: string
): string {

  let index =
    1;

  let id =
    `${baseName}${index}`;


  while (
    ports.some(
      (port) =>
        port.id === id
    )
  ) {

    index +=
      1;

    id =
      `${baseName}${index}`;
  }


  return id;
}


/* =======================================================
 * Add Data InPort
 * ======================================================= */

const addDataInPort =
  useCallback(
    () => {

      if (!selectedNodeId) {
        return;
      }


      updateRTCData(
        selectedNodeId,

        (data) => {

          const id =
            createUniquePortId(
              data.ports,
              'in'
            );


          const newPort:
            RTCPort = {

            id,

            name:
              id,

            portType:
              'data',

            direction:
              'in',

            dataType:
              '',
          };


          return {
            ...data,

            ports: [
              ...data.ports,
              newPort,
            ],
          };

        }
      );

    },

    [
      selectedNodeId,
      updateRTCData,
    ],
  );


/* =======================================================
 * Add Data OutPort
 * ======================================================= */

const addDataOutPort =
  useCallback(
    () => {

      if (!selectedNodeId) {
        return;
      }


      updateRTCData(
        selectedNodeId,

        (data) => {

          const id =
            createUniquePortId(
              data.ports,
              'out'
            );


          const newPort:
            RTCPort = {

            id,

            name:
              id,

            portType:
              'data',

            direction:
              'out',

            dataType:
              '',
          };


          return {
            ...data,

            ports: [
              ...data.ports,
              newPort,
            ],
          };

        }
      );

    },

    [
      selectedNodeId,
      updateRTCData,
    ],
  );


/* =======================================================
 * Add ServicePort
 * ======================================================= */

const addServicePort =
  useCallback(
    () => {

      if (!selectedNodeId) {
        return;
      }


      updateRTCData(
        selectedNodeId,

        (data) => {

          const id =
            createUniquePortId(
              data.ports,
              'service'
            );


          const newPort:
            RTCServicePort = {

            id,

            name:
              id,

            portType:
              'service',

            interfaces:
              [],
          };


          return {
            ...data,

            ports: [
              ...data.ports,
              newPort,
            ],
          };

        }
      );

    },

    [
      selectedNodeId,
      updateRTCData,
    ],
  );


/* =======================================================
 * Delete Port
 * ======================================================= */

const deletePort =
  useCallback(
    (
      portIndex:
        number
    ) => {

      if (!selectedNodeId) {
        return;
      }


      const node =
        nodes.find(
          (currentNode) =>
            currentNode.id ===
            selectedNodeId
        );


      if (!node) {
        return;
      }


      const data =
        node.data as
          RTCNodeData;


      const targetPort =
        data.ports[
          portIndex
        ];


      if (!targetPort) {
        return;
      }


      /*
       * Portを削除
       */

      updateRTCData(
        selectedNodeId,

        (currentData) => {

          return {
            ...currentData,

            ports:
              currentData
                .ports
                .filter(
                  (
                    _,
                    index
                  ) =>
                    index !==
                    portIndex
                ),
          };

        }
      );


      /*
       * このPortに接続されていたEdgeも削除
       */

      setEdges(
        (currentEdges) =>
          currentEdges.filter(
            (edge) => {

              const isSource =
                edge.source ===
                  selectedNodeId
                &&
                edge.sourceHandle ===
                  targetPort.id;


              const isTarget =
                edge.target ===
                  selectedNodeId
                &&
                edge.targetHandle ===
                  targetPort.id;


              return (
                !isSource
                &&
                !isTarget
              );

            }
          )
      );

    },

    [
      selectedNodeId,
      nodes,
      updateRTCData,
      setEdges,
    ],
  );

/* =======================================================
 * Data Port Update
 * ======================================================= */

const updateDataPort =
  useCallback(
    (
      portIndex: number,
      field:
        | 'name'
        | 'dataType',
      value: string,
    ) => {

      if (!selectedNodeId) {
        return;
      }


      updateRTCData(
        selectedNodeId,

        (data) => {

          const ports =
            data.ports.map(
              (
                port,
                index
              ) => {

                if (
                  index !==
                  portIndex
                ) {
                  return port;
                }


                if (
                  port.portType !==
                  'data'
                ) {
                  return port;
                }


                return {
                  ...port,

                  [field]:
                    value,
                };

              }
            );


          return {
            ...data,

            ports,
          };

        }
      );

    },

    [
      selectedNodeId,
      updateRTCData,
    ],
  );


/* =======================================================
 * Service Port Name Update
 * ======================================================= */

const updateServicePortName =
  useCallback(
    (
      portIndex:
        number,

      value:
        string
    ) => {

      if (!selectedNodeId) {
        return;
      }


      updateRTCData(
        selectedNodeId,

        (data) => {

          const ports =
            data.ports.map(
              (
                port,
                index
              ) => {

                if (
                  index !==
                  portIndex
                ) {
                  return port;
                }


                if (
                  port.portType !==
                  'service'
                ) {
                  return port;
                }


                return {
                  ...port,

                  name:
                    value,
                };

              }
            );


          return {
            ...data,

            ports,
          };

        }
      );

    },

    [
      selectedNodeId,
      updateRTCData,
    ],
  );


/* =======================================================
 * Add Service Interface
 * ======================================================= */

/* =======================================================
 * Add Service Interface
 * ======================================================= */

const addServiceInterface =
  useCallback(
    (
      portIndex:
        number
    ) => {

      if (!selectedNodeId) {
        return;
      }


      updateRTCData(
        selectedNodeId,

        (data) => {

          const ports: RTCPort[] =
            data.ports.map(
              (
                port,
                index
              ): RTCPort => {

                if (
                  index !==
                  portIndex
                ) {
                  return port;
                }


                if (
                  port.portType !==
                  'service'
                ) {
                  return port;
                }


                const newInterface:
                  RTCServiceInterface = {

                  name:
                    '',

                  interfaceType:
                    '',

                  polarity:
                    'consumer',
                };


                return {
                  ...port,

                  interfaces: [
                    ...port.interfaces,
                    newInterface,
                  ],
                };

              }
            );


          return {
            ...data,

            ports,
          };

        }
      );

    },

    [
      selectedNodeId,
      updateRTCData,
    ],
  );


/* =======================================================
 * Update Service Interface
 * ======================================================= */

/* =======================================================
 * Update Service Interface
 * ======================================================= */

const updateServiceInterface =
  useCallback(
    (
      portIndex:
        number,

      interfaceIndex:
        number,

      field:
        | 'name'
        | 'interfaceType'
        | 'polarity',

      value:
        string
    ) => {

      if (!selectedNodeId) {
        return;
      }


      updateRTCData(
        selectedNodeId,

        (data) => {

          const ports: RTCPort[] =
            data.ports.map(
              (
                port,
                index
              ): RTCPort => {

                if (
                  index !==
                  portIndex
                ) {
                  return port;
                }


                if (
                  port.portType !==
                  'service'
                ) {
                  return port;
                }


                const interfaces:
                  RTCServiceInterface[] =
                    port.interfaces.map(
                      (
                        serviceInterface,
                        currentInterfaceIndex
                      ): RTCServiceInterface => {

                        if (
                          currentInterfaceIndex !==
                          interfaceIndex
                        ) {
                          return serviceInterface;
                        }


                        if (
                          field ===
                          'polarity'
                        ) {

                          if (
                            value !==
                            'consumer'
                            &&
                            value !==
                            'provider'
                          ) {
                            return serviceInterface;
                          }


                          return {
                            ...serviceInterface,

                            polarity:
                              value,
                          };

                        }


                        if (
                          field ===
                          'name'
                        ) {

                          return {
                            ...serviceInterface,

                            name:
                              value,
                          };

                        }


                        return {
                          ...serviceInterface,

                          interfaceType:
                            value,
                        };

                      }
                    );


                return {
                  ...port,

                  interfaces,
                };

              }
            );


          return {
            ...data,

            ports,
          };

        }
      );

    },

    [
      selectedNodeId,
      updateRTCData,
    ],
  );


/* =======================================================
 * Delete Service Interface
 * ======================================================= */

const deleteServiceInterface =
  useCallback(
    (
      portIndex:
        number,

      interfaceIndex:
        number
    ) => {

      if (!selectedNodeId) {
        return;
      }


      updateRTCData(
        selectedNodeId,

        (data) => {

          const ports =
            data.ports.map(
              (
                port,
                index
              ) => {

                if (
                  index !==
                  portIndex
                ) {
                  return port;
                }


                if (
                  port.portType !==
                  'service'
                ) {
                  return port;
                }


                return {
                  ...port,

                  interfaces:
                    port.interfaces.filter(
                      (
                        _,
                        currentInterfaceIndex
                      ) =>
                        currentInterfaceIndex !==
                        interfaceIndex
                    ),
                };

              }
            );


          return {
            ...data,

            ports,
          };

        }
      );

    },

    [
      selectedNodeId,
      updateRTCData,
    ],
  );

  /* =======================================================
   * Configuration Update
   * ======================================================= */

  const updateConfiguration =
    useCallback(
      (
        index:
          number,

        value:
          string
      ) => {

        if (!selectedNodeId) {
          return;
        }


        updateRTCData(
          selectedNodeId,

          (data) => {

            const configuration =
              data.configuration.map(
                (
                  config,
                  currentIndex
                ) => {

                  if (
                    currentIndex !==
                    index
                  ) {

                    return config;

                  }


                  return {

                    ...config,

                    value,

                  };

                }
              );


            return {

              ...data,

              configuration,

            };

          }
        );

      },

      [
        selectedNodeId,
        updateRTCData,
      ],
    );


  /* =======================================================
   * Implementation Update
   * ======================================================= */

  const updateImplementation =
    useCallback(
      (
        field:
          keyof RTCImplementationSpec,

        value:
          string
      ) => {

        if (!selectedNodeId) {
          return;
        }


        updateRTCData(
          selectedNodeId,

          (data) => ({

            ...data,

            implementation: {

              ...data.implementation,

              [field]:
                value,

            },

          })
        );

      },

      [
        selectedNodeId,
        updateRTCData,
      ],
    );


  /* =======================================================
   * Save Session
   * ======================================================= */

  const saveSession =
    useCallback(
      async () => {

        if (!sessionId) {
          return;
        }

        try {

          const response =
            await fetch(
              `${API_BASE_URL}/api/sessions/${encodeURIComponent(sessionId)}`,
              {
                method:
                  'PUT',

                headers: {
                  'Content-Type':
                    'application/json',
                },

                body:
                  JSON.stringify({
                    nodes,
                    edges,
                  }),
              }
            );

          if (!response.ok) {

            throw new Error(
              `保存失敗 (${response.status})`
            );

          }

          window.alert(
            'システム構成を保存しました。'
          );

        }
        catch (error) {

          console.error(
            error
          );

          window.alert(
            '保存に失敗しました。'
          );

        }

      },

      [
        sessionId,
        nodes,
        edges,
      ],
    );


  /* =======================================================
   * Render
   * ======================================================= */

  return (

    <div className="app">


      {/* =================================================
          Header
          ================================================= */}

      <header className="app-header">

        <div>

          <span>
            OpenRTM Visual System Designer
          </span>


          {
            sessionName
            &&
            (
              <span className="project-name">

                {' - '}

                {sessionName}

              </span>
            )
          }

        </div>


        <div className="header-buttons">

          <button
            className="add-rtc-button"

            onClick={
              () =>
                setShowRTCDialog(
                  true
                )
            }

            disabled={
              rtcTemplates.length ===
              0
            }
          >
            + RTC追加
          </button>


          <button
            className="add-rtc-button"

            onClick={
              saveSession
            }

            disabled={
              !sessionId
            }
          >
            保存
          </button>

        </div>

      </header>


      {/* =================================================
          Status
          ================================================= */}

      {
        sessionLoading
        &&
        (
          <div className="catalog-status">

            Sessionを読み込んでいます...

          </div>
        )
      }


      {
        sessionError
        &&
        (
          <div className="catalog-error">

            {sessionError}

          </div>
        )
      }


      {
        !sessionLoading
        &&
        !sessionError
        &&
        !sessionId
        &&
        (
          <div className="catalog-status">

            Sessionが指定されていません。

          </div>
        )
      }


      {/* =================================================
          Designer Layout
          ================================================= */}

      <div className="designer-layout">


        {/* ===============================================
            React Flow
            =============================================== */}

        <main className="flow-container">

          <ReactFlow

            nodes={
              nodes
            }

            edges={
              edges
            }

            nodeTypes={
              nodeTypes
            }

            onNodesChange={
              onNodesChange
            }

            onEdgesChange={
              onEdgesChange
            }

            onConnect={
              onConnect
            }

            isValidConnection={
              isValidConnection
            }

            onNodeClick={
              onNodeClick
            }

            onPaneClick={
              onPaneClick
            }

            connectionMode={
              ConnectionMode.Loose
            }

            deleteKeyCode={[
              'Delete',
              'Backspace',
            ]}

            fitView
          >

            <Background />

            <Controls />

            <MiniMap />

          </ReactFlow>

        </main>


        {/* ===============================================
            Property Panel
            =============================================== */}

        {
          selectedRTC
          &&
          selectedNode
          &&
          (

            <aside className="property-panel">


              {/* -----------------------------------------
                  Property Header
                  ----------------------------------------- */}

              <div className="property-header">

                <div>

                  <div className="property-title">

                    {selectedRTC.name}

                  </div>


                  <div className="property-subtitle">

                    {selectedRTC.instanceName}

                  </div>

                </div>


                <button
                  className="property-close"

                  onClick={
                    () =>
                      setSelectedNodeId(
                        null
                      )
                  }
                >
                  ×
                </button>

              </div>


              {/* -----------------------------------------
                  Tabs
                  ----------------------------------------- */}

              <div className="property-tabs">

                <button
                  className={
                    propertyTab ===
                    'general'
                      ? 'property-tab active'
                      : 'property-tab'
                  }

                  onClick={
                    () =>
                      setPropertyTab(
                        'general'
                      )
                  }
                >
                  General
                </button>


                <button
                  className={
                    propertyTab ===
                    'deployment'
                      ? 'property-tab active'
                      : 'property-tab'
                  }

                  onClick={
                    () =>
                      setPropertyTab(
                        'deployment'
                      )
                  }
                >
                  Deployment
                </button>


                <button
                  className={
                    propertyTab ===
                    'configuration'
                      ? 'property-tab active'
                      : 'property-tab'
                  }

                  onClick={
                    () =>
                      setPropertyTab(
                        'configuration'
                      )
                  }
                >
                  Configuration
                </button>


                <button
                  className={
                    propertyTab ===
                    'ports'
                      ? 'property-tab active'
                      : 'property-tab'
                  }

                  onClick={
                    () =>
                      setPropertyTab(
                        'ports'
                      )
                  }
                >
                  Ports
                </button>


                <button
                  className={
                    propertyTab ===
                    'implementation'
                      ? 'property-tab active'
                      : 'property-tab'
                  }

                  onClick={
                    () =>
                      setPropertyTab(
                        'implementation'
                      )
                  }
                >
                  Implementation
                </button>

              </div>


              {/* =========================================
                  General
                  ========================================= */}

              {
                propertyTab ===
                'general'
                &&
                (

                  <div className="property-content">

                    <label>
                      RTC Type
                    </label>

                    <input
                      value={
                        selectedRTC.name
                      }

                      onChange={
                        (event) =>
                          updateRTCType(
                            event.target.value
                          )
                      }
                    />


                    <label>
                      Instance Name
                    </label>

                    <input
                      value={
                        selectedRTC.instanceName
                      }

                      onChange={
                        (event) =>
                          updateInstanceName(
                            event.target.value
                          )
                      }
                    />


                    <label>
                      State
                    </label>

                    <input
                      value={
                        selectedRTC.state
                      }

                      readOnly
                    />


                    <div className="property-section">
                      rtc.conf
                    </div>


                    <label>
                      CORBA Name Servers
                    </label>

                    <input
                      value={
                        selectedRTC
                          .rtcConf
                          .corbaNameServers
                      }

                      onChange={
                        (event) =>
                          updateRTCConf(
                            'corbaNameServers',
                            event.target.value
                          )
                      }
                    />


                    <label>
                      manager.shutdown_auto
                    </label>

                    <input
                      value={
                        selectedRTC
                          .rtcConf
                          .managerShutdownAuto
                      }

                      onChange={
                        (event) =>
                          updateRTCConf(
                            'managerShutdownAuto',
                            event.target.value
                          )
                      }
                    />

                  </div>

                )
              }


              {/* =========================================
                  Deployment
                  ========================================= */}

              {
                propertyTab ===
                'deployment'
                &&
                (

                  <div className="property-content">

                    <label>
                      Host
                    </label>

                    <input
                      value={
                        selectedRTC
                          .deployment
                          .host
                      }

                      onChange={
                        (event) =>
                          updateDeployment(
                            'host',
                            event.target.value
                          )
                      }
                    />


                    <label>
                      Executable
                    </label>

                    <input
                      value={
                        selectedRTC
                          .deployment
                          .executable
                      }

                      onChange={
                        (event) =>
                          updateDeployment(
                            'executable',
                            event.target.value
                          )
                      }
                    />


                    <label>
                      Working Directory
                    </label>

                    <input
                      value={
                        selectedRTC
                          .deployment
                          .workingDirectory
                      }

                      onChange={
                        (event) =>
                          updateDeployment(
                            'workingDirectory',
                            event.target.value
                          )
                      }
                    />


                    <label>
                      Arguments
                    </label>

                    <textarea
                      rows={3}

                      value={
                        selectedRTC
                          .deployment
                          .arguments
                      }

                      onChange={
                        (event) =>
                          updateDeployment(
                            'arguments',
                            event.target.value
                          )
                      }
                    />


                    <label>
                      Environment
                    </label>

                    <textarea
                      rows={5}

                      placeholder={
                        'PATH=...\nRTC_LOG_LEVEL=INFO'
                      }

                      value={
                        selectedRTC
                          .deployment
                          .environment
                      }

                      onChange={
                        (event) =>
                          updateDeployment(
                            'environment',
                            event.target.value
                          )
                      }
                    />

                  </div>

                )
              }


              {/* =========================================
                  Configuration
                  ========================================= */}

              {
                propertyTab ===
                'configuration'
                &&
                (

                  <div className="property-content">

                    {
                      selectedRTC
                        .configuration
                        .length === 0
                      &&
                      (
                        <div className="empty-message">

                          Configuration parameterはありません。

                        </div>
                      )
                    }


                    {
                      selectedRTC
                        .configuration
                        .map(
                          (
                            config,
                            index
                          ) => (

                            <div
                              className="configuration-item"

                              key={
                                `${config.name}-${index}`
                              }
                            >

                              <label>
                                {config.name}
                              </label>

                              <input
                                value={
                                  config.value
                                }

                                onChange={
                                  (event) =>
                                    updateConfiguration(
                                      index,
                                      event.target.value
                                    )
                                }
                              />

                            </div>

                          )
                        )
                    }

                  </div>

                )
              }


              {/* =========================================
                  Ports
                  ========================================= */}

              {
                propertyTab === 'ports'
                &&
                selectedRTC
                &&
                (

                  <div className="property-content">

                    {/* =====================================
                        Add Port
                        ===================================== */}

                    <div className="port-add-section">

                      <div className="property-section">
                        Add Port
                      </div>


                      <div className="port-add-buttons">

                        <button
                          type="button"
                          className="small-action-button"
                          onClick={addDataInPort}
                        >
                          + InPort
                        </button>


                        <button
                          type="button"
                          className="small-action-button"
                          onClick={addDataOutPort}
                        >
                          + OutPort
                        </button>


                        <button
                          type="button"
                          className="small-action-button"
                          onClick={addServicePort}
                        >
                          + ServicePort
                        </button>

                      </div>

                    </div>

                    {
                      selectedRTC.ports.map(
                        (
                          port,
                          portIndex
                        ) => (

                          <div
                            className="port-property"
                            key={
                              `${port.id}-${portIndex}`
                            }
                          >

                            {/* =====================================
                                DataPort
                                ===================================== */}

                            {
                              port.portType === 'data'
                              &&
                              (
                                <>

                                  <div className="property-section">

                                    {
                                      port.direction === 'in'
                                        ? 'Data InPort'
                                        : 'Data OutPort'
                                    }

                                  </div>


                                  {/* Port Name */}

                                  <label>
                                    Port Name
                                  </label>

                                  <input
                                    value={
                                      port.name
                                    }

                                    onChange={
                                      (event) =>
                                        updateDataPort(
                                          portIndex,
                                          'name',
                                          event.target.value
                                        )
                                    }
                                  />


                                  {/* Data Type */}

                                  <label>
                                    Data Type
                                  </label>

                                  <input
                                    placeholder="未指定"
                                    value={
                                      port.dataType ?? ''
                                    }

                                    onChange={
                                      (event) =>
                                        updateDataPort(
                                          portIndex,
                                          'dataType',
                                          event.target.value
                                        )
                                    }
                                  />


                                  {/* Direction */}

                                  <div className="port-readonly-info">

                                    Direction:
                                    {' '}

                                    {
                                      port.direction === 'in'
                                        ? 'InPort'
                                        : 'OutPort'
                                    }

                                  </div>

                                </>
                              )
                            }


                            {/* =====================================
                                ServicePort
                                ===================================== */}

                            {
                              port.portType === 'service'
                              &&
                              (
                                <>

                                  <div className="property-section">
                                    ServicePort
                                  </div>


                                  {/* Port Name */}

                                  <label>
                                    Port Name
                                  </label>

                                  <input
                                    value={
                                      port.name
                                    }

                                    onChange={
                                      (event) =>
                                        updateServicePortName(
                                          portIndex,
                                          event.target.value
                                        )
                                    }
                                  />


                                  {/* =================================
                                      Service Interfaces
                                      ================================= */}

                                  <div
                                    className=
                                      "service-interface-editor-header"
                                  >

                                    <strong>
                                      Service Interfaces
                                    </strong>


                                    <button
                                      type="button"

                                      className=
                                        "small-action-button"

                                      onClick={
                                        () =>
                                          addServiceInterface(
                                            portIndex
                                          )
                                      }
                                    >
                                      + Interface
                                    </button>

                                  </div>


                                  {/* Interface未設定 */}

                                  {
                                    port.interfaces.length === 0
                                    &&
                                    (
                                      <div
                                        className=
                                          "port-unconfigured-info"
                                      >
                                        Interface未設定
                                      </div>
                                    )
                                  }


                                  {/* =================================
                                      Interfaces
                                      ================================= */}

                                  {
                                    port.interfaces.map(
                                      (
                                        serviceInterface,
                                        interfaceIndex
                                      ) => (

                                        <div
                                          className=
                                            "service-interface-editor"

                                          key={
                                            `${port.id}-interface-${interfaceIndex}`
                                          }
                                        >

                                          {/* Interface Name */}

                                          <label>
                                            Interface Name
                                          </label>

                                          <input
                                            placeholder="未指定"

                                            value={
                                              serviceInterface.name ??
                                              ''
                                            }

                                            onChange={
                                              (event) =>
                                                updateServiceInterface(
                                                  portIndex,
                                                  interfaceIndex,
                                                  'name',
                                                  event.target.value
                                                )
                                            }
                                          />


                                          {/* Interface Type */}

                                          <label>
                                            Interface Type
                                          </label>

                                          <input
                                            placeholder="未指定"

                                            value={
                                              serviceInterface.interfaceType ??
                                              ''
                                            }

                                            onChange={
                                              (event) =>
                                                updateServiceInterface(
                                                  portIndex,
                                                  interfaceIndex,
                                                  'interfaceType',
                                                  event.target.value
                                                )
                                            }
                                          />


                                          {/* Polarity */}

                                          <label>
                                            Polarity
                                          </label>

                                          <select
                                            value={
                                              serviceInterface.polarity
                                            }

                                            onChange={
                                              (event) =>
                                                updateServiceInterface(
                                                  portIndex,
                                                  interfaceIndex,
                                                  'polarity',
                                                  event.target.value
                                                )
                                            }
                                          >

                                            <option value="consumer">
                                              Consumer
                                            </option>

                                            <option value="provider">
                                              Provider
                                            </option>

                                          </select>


                                          {/* Delete */}

                                          <button
                                            type="button"

                                            className=
                                              "delete-interface-button"

                                            onClick={
                                              () =>
                                                deleteServiceInterface(
                                                  portIndex,
                                                  interfaceIndex
                                                )
                                            }
                                          >
                                            Interface削除
                                          </button>

                                        </div>

                                      )
                                    )
                                  }

                                </>
                              )
                            }

                          <button
                          type="button"
                          className="delete-port-button"
                          onClick={
                            () =>
                              deletePort(
                                portIndex
                              )
                          }
                        >
                          Port削除
                        </button>


                          </div>

                        )
                      )
                    }

                  </div>

                )
              }


              {/* =========================================
                  Implementation
                  ========================================= */}

              {
                propertyTab ===
                'implementation'
                &&
                (

                  <div className="property-content">

                    <div className="property-section">
                      AI Implementation Instructions
                    </div>


                    <label>
                      Summary
                    </label>

                    <textarea
                      rows={3}

                      placeholder={
                        'このRTCで実装する処理の概要を記述します。'
                      }

                      value={
                        selectedRTC
                          .implementation
                          .summary
                      }

                      onChange={
                        (event) =>
                          updateImplementation(
                            'summary',
                            event.target.value
                          )
                      }
                    />


                    <label>
                      Requirements
                    </label>

                    <textarea
                      rows={7}

                      placeholder={
                        '実装しなければならない機能や動作を記述します。'
                      }

                      value={
                        selectedRTC
                          .implementation
                          .requirements
                      }

                      onChange={
                        (event) =>
                          updateImplementation(
                            'requirements',
                            event.target.value
                          )
                      }
                    />


                    <label>
                      Constraints
                    </label>

                    <textarea
                      rows={6}

                      placeholder={
                        '使用するライブラリ、変更してはいけないファイルなどの制約を記述します。'
                      }

                      value={
                        selectedRTC
                          .implementation
                          .constraints
                      }

                      onChange={
                        (event) =>
                          updateImplementation(
                            'constraints',
                            event.target.value
                          )
                      }
                    />


                    <label>
                      Notes
                    </label>

                    <textarea
                      rows={6}

                      placeholder={
                        '生成AIに伝えておきたい補足情報を記述します。'
                      }

                      value={
                        selectedRTC
                          .implementation
                          .notes
                      }

                      onChange={
                        (event) =>
                          updateImplementation(
                            'notes',
                            event.target.value
                          )
                      }
                    />

                  </div>

                )
              }

            </aside>

          )
        }

      </div>


      {/* =================================================
          RTC Selection Dialog
          ================================================= */}

      {
        showRTCDialog
        &&
        (

          <div className="rtc-dialog-overlay">

            <div className="rtc-dialog">

              <div className="rtc-dialog-header">

                <h2>
                  RTCを選択
                </h2>


                <button
                  className="rtc-dialog-close"

                  onClick={
                    () =>
                      setShowRTCDialog(
                        false
                      )
                  }
                >
                  ×
                </button>

              </div>

              <div className="rtc-create-new">

                <button
                  className="rtc-create-new-button"

                  onClick={
                    createNewRTC
                  }
                >

                  <div className="rtc-list-name">
                    + 新規RTCを作成
                  </div>

                  <div className="rtc-list-ports">
                    型未指定のInPort / OutPort /
                    ServicePortを作成
                  </div>

                </button>

              </div>

              <div className="rtc-list">

                {
                  rtcTemplates.map(
                    (
                      rtc,
                      index
                    ) => (

                      <button
                        key={
                          `${rtc.name}-${index}`
                        }

                        className="rtc-list-item"

                        onClick={
                          () =>
                            addRTC(
                              rtc
                            )
                        }
                      >

                        <div className="rtc-list-name">

                          {rtc.name}

                        </div>


                        <div className="rtc-list-ports">

                          Data:
                          {' '}

                          {
                            rtc.ports.filter(
                              (port) =>
                                port.portType ===
                                'data'
                            ).length
                          }


                          {' / '}


                          Service:
                          {' '}

                          {
                            rtc.ports.filter(
                              (port) =>
                                port.portType ===
                                'service'
                            ).length
                          }

                        </div>

                      </button>

                    )
                  )
                }

              </div>

            </div>

          </div>

        )
      }

    </div>

  );
}


/* =========================================================
 * App
 * ========================================================= */

export default function App() {

  return (

    <ReactFlowProvider>

      <RTCEditor />

    </ReactFlowProvider>

  );

}