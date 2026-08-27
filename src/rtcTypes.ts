export type RTCState =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'ERROR'
  | 'UNKNOWN';


/* =========================================================
 * Data Port
 * ========================================================= */

export type RTCDataPort = {
  id: string;
  name: string;

  portType: 'data';

  direction:
    | 'in'
    | 'out';

  dataType: string;
};


/* =========================================================
 * Service Interface
 * ========================================================= */

export type RTCServiceInterface = {
  name: string;

  interfaceType: string;

  polarity:
    | 'consumer'
    | 'provider';
};


/* =========================================================
 * Service Port
 * ========================================================= */

export type RTCServicePort = {
  id: string;
  name: string;

  portType: 'service';

  interfaces: RTCServiceInterface[];
};


/* =========================================================
 * Port
 * ========================================================= */

export type RTCPort =
  | RTCDataPort
  | RTCServicePort;


/* =========================================================
 * Deployment
 * ========================================================= */

export type RTCDeployment = {
  host: string;

  executable: string;

  workingDirectory: string;

  arguments: string;

  environment: string;
};


/* =========================================================
 * rtc.conf
 * ========================================================= */

export type RTCConf = {
  corbaNameServers: string;

  managerShutdownAuto: string;
};


/* =========================================================
 * Configuration
 * ========================================================= */

export type RTCConfiguration = {
  name: string;

  value: string;
};


/* =========================================================
 * Implementation specification
 *
 * 生成AI / Codexに渡す実装指示
 * ========================================================= */

export type RTCImplementationSpec = {
  /*
   * RTCが何を実装するかの概要
   */
  summary: string;

  /*
   * 実装しなければならない機能・動作
   */
  requirements: string;

  /*
   * 実装上の制約
   */
  constraints: string;

  /*
   * その他の補足事項
   */
  notes: string;
};


/* =========================================================
 * RTC Node Data
 * ========================================================= */

export type RTCNodeData = {
  name: string;

  instanceName: string;

  state: RTCState;

  ports: RTCPort[];

  deployment: RTCDeployment;

  rtcConf: RTCConf;

  configuration: RTCConfiguration[];

  /*
   * 生成AI向け実装情報
   */
  implementation: RTCImplementationSpec;
};