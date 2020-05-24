const get = (
  obj: Record<string, any>,
  path: string,
  defaultValue: any
): any => {
  function stringToPath(path: string) {
    const output = [];
    path.split(".").forEach((item) => {
      item.split(/\[([^}]+)\]/g).forEach((key) => {
        if (key.length > 0) {
          output.push(key);
        }
      });
    });
    return output;
  }
  const pathArray = stringToPath(path);
  let current = obj;
  for (let i = 0; i < pathArray.length; i++) {
    if (!current[pathArray[i]]) return defaultValue;
    current = current[pathArray[i]];
  }
  return current;
};

const addSettings = (newData) => {
  return {
    settings: {
      startNodeId: get(newData, "pathData.startNodeId", ""),
      stageWidth: 720,
      stageHeight: 405,
    },
  };
};

const addVersion = () => {
  return {
    version: "1.0.0-rc.4",
  };
};

const makeNodesAndHotspots = (newData) => {
  const nodes = [];
  const hotspots = [];
  const cues = [];
  get(newData, "nodes", []).forEach((node) => {
    let onEnded = [
      {
        type: "project:stop",
        payload: {},
      },
    ];
    const prefetchNodeIds = [];
    const duration = get(node, 'pathData.duration', 0);
    get(node, "interactions", []).forEach((interaction) => {
      const behavior = get(interaction, "data.behavior", {});
      if (
        interaction.type === "@@core/postPlay" &&
        behavior.type === "GoToNode"
      ) {
        prefetchNodeIds.push(behavior.nodeId);
        onEnded = [
          {
            type: "project:jump",
            payload: {
              destination: behavior.nodeId,
              startFrom: behavior.startTime || 0,
            },
          },
        ];
      } else if (interaction.type === "@@core/cue") {
        cues.push({
          at: interaction.startTime / duration,
          customData: get(interaction, 'data.customData', ''),
          id: interaction.id,
          nodeId: node.id,
        });
      } else if (interaction.type === "@@core/hotspot") {
        const data = get(interaction, "data", {});
        const label = get(data, "text.label", "");
        const hotspot: any = {
          id: interaction.id,
          name: label,
          nodeId: node.id,
          label,
          showAt: interaction.startTime / duration,
          hideAt: interaction.endTime / duration,
          style: data.style || {},
          position: data.position || {},
          customData: get(interaction, "pathData.customData", null),
          onClick: [],
        };
        if (behavior.type === "Pause") {
          hotspot.onClick = [
            {
              type: "player:pause",
              payload: {},
            },
          ];
        } else if (behavior.type === "GoToNode") {
          prefetchNodeIds.push(behavior.nodeId);
          hotspot.onClick = [
            {
              type: "project:jump",
              payload: {
                destination: behavior.nodeId,
                startFrom: behavior.startTime || 0,
              },
            },
          ];
        } else if (behavior.type === "GoToUrl") {
          hotspot.onClick = [
            {
              type: "player:pause",
              payload: {},
            },
            {
              type: "browser:open",
              payload: {
                href: behavior.url,
              },
            },
          ];
        }
        hotspots.push(hotspot);
      }
    });

    nodes.push({
      id: node.id,
      xref: null,
      name: node.name,
      customData: get(node, "pathData.customData", null),
      entryId: node.entryId,
      onEnded,
      prefetchNodeIds,
      startFrom: node.startTime
    });
  });
  return [nodes, hotspots, cues];
};

const addFonts = (newData) => {
  return {
    fonts: get(newData, 'pathData.fonts', []),
  };
};

const addSkins = (newData) => {
  const result = {};
  get(newData, 'pathData.skins', []).forEach((skin) => {
    result[skin.id] = skin;
  });
  return {
    __skins: result,
  };
};

const addAcconunt = (newData) => {
  return {
    account: {
      id: get(newData, 'account.id', ""),
    },
  };
};

const convertApiResponce = (newData) => {
  try{
    const [nodes, hotspots, cues] = makeNodesAndHotspots(newData);
    const result = {
      ...addVersion(),
      ...addSettings(newData),
      ...addFonts(newData),
      ...addSkins(newData),
      ...addAcconunt(newData),
      nodes,
      hotspots,
      cues
    };
    return result;
  }catch(e){
    console.error("Failed to convert data",e,newData); 
  }
};

export default convertApiResponce;