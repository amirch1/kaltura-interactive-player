import { PlayersManager, RaptNode } from "./PlayersManager";
import { KipClient } from "./KipClient";
import { CreateElement } from "./helpers/CreateElement";
import { Dispatcher, KivEvent } from "./helpers/Dispatcher";
import { BufferEvent } from "./PlayersBufferManager";

const API_EVENTS = [
  "browser:hidden",
  "browser:open",
  "cue:forward",
  "cue:reverse",
  "hotspot:click",
  "node:enter",
  "node:ended",
  "node:exit",
  "project:load",
  "project:ready",
  "project:start",
  "project:ended",
  "project:unload",
  "player:play",
  "player:pause",
  "player:progress",
  "player:ratechange",
  "player:timeupdate",
  "player:volumechange"
];

class KalturaInteractiveVideo extends Dispatcher {
  private playerManager: PlayersManager;
  private mainDiv: HTMLElement;
  private playlistId: string = "";
  private client: KipClient; // Backend Client
  private _data: any; // container to data API
  private legacyCallback: (event: any) => void; // legacy API generic callback func

  constructor(private config: any, private playerLibrary: any) {
    super();
  }

  loadMedia(obj: any): void {
    if (!obj || !obj.entryId) {
      // todo - handle errors API
      this.printMessage("Error", "missing rapt project id");
      return;
    }
    // create a top-level container
    this.mainDiv = CreateElement(
      "div",
      "kiv-container__" + obj.entryId,
      "kiv-container"
    );
    document.getElementById(this.config.targetId).appendChild(this.mainDiv);

    let ks: string =
      this.config.session && this.config.session.ks
        ? this.config.session.ks
        : "";
    this.client = new KipClient({
      ks: ks,
      partnerId: this.config.provider.partnerId
    }); //TODO add serviceUrl
    this.playlistId = obj.entryId;
    this.client
      .loadRaptData(this.playlistId)
      .then(graphData => {
        this.dataLoaded(graphData);
      })
      .catch((err: string) => {
        this.printMessage("API Error", err);
        this.dispatchApi({ type: "Error" });
      });
  }

  /**
   * Once the graph-data is loaded - load the 1st media and place the rapt-engine layer
   * @param raptGraphData
   */
  dataLoaded(raptGraphData: object): void {
    raptGraphData["account"] = { id: this.config.provider.partnerId };
    this._data = raptGraphData;
    this.playerManager = new PlayersManager(
      Object.assign({}, this.config),
      this.playerLibrary,
      this.playlistId,
      raptGraphData,
      this.mainDiv
    );

    // reflect all buffering evnets to the API
    for (let o of Object.values(BufferEvent)) {
      this.playerManager.addListener(o, (event: KivEvent) => {
        // translate to
        this.dispatchApi(event);
      });
    }

    for (let eventName of API_EVENTS) {
      this.playerManager.addListener(eventName, (event: KivEvent) => {
        this.dispatchApi(event);
      });
    }
    this.playerManager.init();
  }
  /**
   * Expose API to the wrapping page/app
   * @param event
   * @param data
   */
  dispatchApi(event: KivEvent) {
    if (this.config.rapt.debug) {
      // debug mode - print to console
      if (event.type === "player:timeupdate") {
        return;
      }
      console.warn("Rapt: > ", event);
    }

    //this is a legacy API
    if (this.legacyCallback) {
      let legacyEvent: any = { type: event.type };
      // send the payload only if it exist
      if (event.payload && Object.getOwnPropertyNames(event.payload).length) {
        legacyEvent.payload = event.payload;
      }
      this.legacyCallback(legacyEvent);
    }

    // expose API, add the current node and
    this.dispatch(event);
  }

  /**
   * Print a message on the main div, usually used to show error messages to the end-user (E.G. missing rapt data)
   * @param title
   * @param text
   */
  printMessage(title: string, text: string = "") {
    const messageDiv = CreateElement("div", null, "kiv-message__message");
    const titleDiv = CreateElement("div", null, "kiv-message__title");
    const bodeDiv = CreateElement("div", null, "kiv-message__body");
    titleDiv.innerHTML = title;
    bodeDiv.innerHTML = text;
    messageDiv.appendChild(titleDiv);
    messageDiv.appendChild(bodeDiv);
    this.mainDiv.appendChild(messageDiv);
  }
  /**
   * Legacy API support
   */
  public pause() {
    this.playerManager.currentPlayer.pause();
  }

  public play() {
    this.playerManager.currentPlayer.play();
  }

  public seek(n: number) {
    this.playerManager.currentPlayer.currentTime = n;
  }

  public replay() {
    this.playerManager.execute({
      type: "project:replay"
    });
  }
  public reset() {
    this.playerManager.execute({
      type: "project:reset"
    });
  }

  public get data(): any {
    return this._data;
  }

  public get currentTime(): number {
    return this.playerManager.currentPlayer.currentTime;
  }

  public get duration(): number {
    return this.playerManager.currentPlayer.duration;
  }

  public get currentNode(): RaptNode {
    return this.playerManager.currentNode;
  }

  public get volume(): number {
    return this.playerManager.currentPlayer.volume;
  }

  public set volume(n: number) {
    this.playerManager.currentPlayer.volume = n;
  }

  public get muted(): number {
    return this.playerManager.currentPlayer.muted;
  }

  public get playbackRate(): number {
    return this.playerManager.currentPlayer.playbackRate;
  }

  public jump(locator: any, autoplay: boolean) {
    this.playerManager.execute({
      type: "project:jump",
      payload: { destination: locator }
    });
  }

  // Legacy API - kBind support
  public kBind(eventName: string, callback: (event: any) => void) {
    if (eventName === "raptMedia_event") {
      this.legacyCallback = callback;
    } else {
      this.addListener(eventName, callback);
    }
  }
  // legacy API - sendNotification with rapt command data
  public sendNotification(doCommand: string, commandObject: any) {
    this.playerManager.execute(commandObject);
  }
  // direct execute
  public execute(commandObject: any) {
    this.playerManager.execute(commandObject);
  }

  public evaluate(key: string): any {
    if (key === "{raptMedia.info}") {
      let dataCopy = Object.assign({}, this._data);
      dataCopy.player = {
        currentPlayer: this.playerManager.currentPlayer,
        currentNode: this.playerManager.currentNode,
        currentVideo: this.playerManager.currentNode.entryId
      };
      dataCopy.project = {
        projectId: this.playerManager.raptProjectId
      };
      dataCopy.videos = this._data.nodes.map((item: RaptNode) => {
        let o: any = {};
        o.entryId = item.entryId;
        o.id = item.id;
        o.name = item.name;
        if (o.customData) {
          o.customData = item.customData;
        }
        return o;
      });
      return dataCopy;
    } else if (this.data[key]) {
      return this.data[key];
    }
  }
}

export default KalturaInteractiveVideo;
