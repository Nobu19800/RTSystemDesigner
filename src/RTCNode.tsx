import {
  Handle,
  Position,
  type NodeProps,
} from '@xyflow/react';

import type {
  RTCNodeData,
  RTCDataPort,
  RTCServicePort,
} from './rtcTypes';

import './App.css';


export default function RTCNode({
  data,
  selected,
}: NodeProps) {

  const rtc =
    data as RTCNodeData;


  /* =======================================================
   * Data Ports
   * ======================================================= */

  const dataInPorts =
    rtc.ports.filter(
      (
        port
      ): port is RTCDataPort =>
        port.portType === 'data'
        &&
        port.direction === 'in'
    );


  const dataOutPorts =
    rtc.ports.filter(
      (
        port
      ): port is RTCDataPort =>
        port.portType === 'data'
        &&
        port.direction === 'out'
    );


  /* =======================================================
   * Service Ports
   * ======================================================= */

  const servicePorts =
    rtc.ports.filter(
      (
        port
      ): port is RTCServicePort =>
        port.portType === 'service'
    );


  return (

    <div
      className={[
        'rtc-node',

        `rtc-state-${rtc.state.toLowerCase()}`,

        selected
          ? 'rtc-node-selected'
          : '',
      ].join(' ')}
    >

      {/* =================================================
          Header
          ================================================= */}

      <div className="rtc-header">

        <div className="rtc-title">
          {rtc.name}
        </div>

        <div className="rtc-instance">
          {rtc.instanceName}
        </div>

        <div className="rtc-state">
          {rtc.state}
        </div>

      </div>


      {/* =================================================
          Data Ports
          ================================================= */}

      {
        (
          dataInPorts.length > 0
          ||
          dataOutPorts.length > 0
        )
        &&
        (
          <>
            <div className="rtc-section-title">
              Data Ports
            </div>

            <div className="rtc-data-ports">

              {/* InPort */}

              <div className="rtc-port-column">

                {
                  dataInPorts.map(
                    (port) => (

                      <div
                        className="rtc-data-port rtc-in-port"
                        key={port.id}
                      >

                        <Handle
                          type="target"
                          position={Position.Left}
                          id={port.id}
                          className="data-handle"
                        />

                        <div className="port-info">

                          <div className="port-name">
                            {port.name}
                          </div>

                          <div className="port-type">
                            {port.dataType}
                          </div>

                        </div>

                      </div>

                    )
                  )
                }

              </div>


              {/* OutPort */}

              <div className="rtc-port-column">

                {
                  dataOutPorts.map(
                    (port) => (

                      <div
                        className="rtc-data-port rtc-out-port"
                        key={port.id}
                      >

                        <div className="port-info">

                          <div className="port-name">
                            {port.name}
                          </div>

                          <div className="port-type">
                            {port.dataType}
                          </div>

                        </div>

                        <Handle
                          type="source"
                          position={Position.Right}
                          id={port.id}
                          className="data-handle"
                        />

                      </div>

                    )
                  )
                }

              </div>

            </div>
          </>
        )
      }


      {/* =================================================
          Service Ports
          ================================================= */}

      {
        servicePorts.length > 0
        &&
        (
          <>
            <div className="rtc-section-title">
              Service Ports
            </div>

            <div className="rtc-service-ports">

              {
                servicePorts.map(
                  (port) => (

                    <div
                      className="rtc-service-port"
                      key={port.id}
                    >

                      <Handle
                        type="source"
                        position={Position.Left}
                        id={port.id}
                        className="service-handle"
                      />

                      <Handle
                        type="target"
                        position={Position.Left}
                        id={port.id}
                        className="service-handle"
                      />


                      <div className="service-port-name">
                        {port.name}
                      </div>


                      <div className="service-interface-list">

                        {
                          port.interfaces.map(
                            (
                              serviceInterface,
                              index
                            ) => (

                              <div
                                className="service-interface"
                                key={
                                  `${serviceInterface.name}-${index}`
                                }
                              >

                                <span
                                  className={
                                    serviceInterface.polarity ===
                                    'provider'
                                      ? 'interface-provider'
                                      : 'interface-consumer'
                                  }
                                >
                                  {
                                    serviceInterface.polarity ===
                                    'provider'
                                      ? 'P'
                                      : 'C'
                                  }
                                </span>

                                <span className="interface-name">
                                  {serviceInterface.name}
                                </span>

                                <span className="interface-type">
                                  {serviceInterface.interfaceType}
                                </span>

                              </div>

                            )
                          )
                        }

                      </div>

                    </div>

                  )
                )
              }

            </div>
          </>
        )
      }

    </div>
  );
}