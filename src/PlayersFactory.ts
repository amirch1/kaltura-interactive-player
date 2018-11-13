import { CreateElement } from "./helpers/CreateElement";
import { RaptConfig } from "./Kip";
import { PlaybackPreset } from "./ui/PlaybackPreset";
import { Dispatcher } from "./helpers/Dispatcher";
import { KipFullscreen } from "./PlayersManager";
import {PlayersDomManager} from "./PlayersDomManager";

export interface persistancy {
    captions?: string;
    audio?: string;
    rate?: number;
}

export class RaptPlayer {

    constructor(public id: string, public player: any) {

    }

    public container: HTMLElement;
}

export class PlayersFactory extends Dispatcher {
    private static instanceCounter = 1;

    readonly SECONDS_TO_BUFFER: number = 6;
    readonly playbackPreset: any;

    constructor(
        readonly domManager: PlayersDomManager,
        readonly raptProjectId: string,
        readonly playerLibrary: any,
        private analyticsInterruptFunc: any,
        private config: any
    ) {
        super();
        this.playbackPreset = new PlaybackPreset(
            this.playerLibrary.ui.h,
            this.playerLibrary.ui.Components,
            () => this.toggleFullscreen() // TODO - check if can be taken out?
        ).preset;
    }

    /**
     *
     * @param entryId
     * @param cachePlayer - whether this player is a cache-player or not. If not - it will set autoplay to true
     */
    public createPlayer(
            entryId: string,
            playImmediate: boolean,
            persistencyObject?: persistancy
    ): RaptPlayer {
        // TODO check if the id already exists and if so throw exception
        const playerContainer = this.createContainer();
        let conf: any = this.getPlayerConf(playerId, playImmediate);

        // persistancy logic of new creation. If a new player is created - push the relevant persistancy attribute to config
        if (persistencyObject) {
            if (persistencyObject.audio) {
                conf.playback.audioLanguage = persistencyObject.audio;
            }
            if (persistencyObject.captions) {
                conf.playback.textLanguage = persistencyObject.captions;
            }
            if (persistencyObject.rate) {
                // todo - find how to initiate this
            }
        }

        this.domManager.tempGetElement().appendChild(playerDiv);
        const newPlayer = this.playerLibrary.setup(conf);
        // @ts-ignore
        newPlayer._uiWrapper._uiManager.store.dispatch({
            type: "shell/UPDATE_PRE_PLAYBACK",
            prePlayback: false
        });
        newPlayer.loadMedia({ entryId: entryId });
        return { player: newPlayer, playerContainer: playerDiv };
    }

    private createContainer() : HTMLElement{
        const playerId: string = this.raptProjectId + "__" + PlayersFactory.instanceCounter;
        PlayersFactory.instanceCounter++;

        let playerClass = "kiv-player kiv-cache-player";
        return CreateElement("div", playerId, playerClass);
    }

    /**
     * Extract the player configuration from the KIV generic config: remove the rapt element and add specific target id
     * @param entryId
     * @param playImmediate - if set to true, the config will use autoPlay=true;
     */
    private getPlayerConf(
        divName: string,
        playImmediate: boolean = false
    ): object {
        // clone the base config
        let newConf: RaptConfig = Object.assign({}, this.config);
        newConf.targetId = divName;
        // > v 0.35
        newConf.plugins = {};
        newConf.plugins.kava = {};
        newConf.plugins.kava.viewEventCountdown = 5; // rapt will send interval every 5 sec (vs 10 default)
        newConf.plugins.kava.tamperAnalyticsHandler = this.analyticsInterruptFunc;
        if (!playImmediate) {
            newConf.playback = {
                autoplay: false,
                preload: "auto",
                options: {
                    html5: {
                        hls: {
                            maxMaxBufferLength: this.SECONDS_TO_BUFFER
                        }
                    }
                }
            };
        } else {
            newConf.playback = {
                autoplay: true
            };
        }

        try {
            let uis = [
                {
                    template: props => this.playbackPreset(props)
                }
            ];
            newConf.ui = newConf.ui || {};
            newConf.ui.customPreset = uis;
        } catch (e) {
            console.log("error in applying V3 custom preset");
        }
        delete newConf.rapt;
        return newConf;
    }

    toggleFullscreen(): void {
        this.dispatch({ type: KipFullscreen.FULL_SCREEN_CLICKED });
    }
}
