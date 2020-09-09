
import EventEmitter from 'events';

import Logger from 'js-logger';

export const STATE = {
  WAITING: 0,
  LOADING: 1,
  LOAD_COMPLETE: 2,
  LOAD_ERROR: 3,
};

// Every asset added to the loader should extend this Asset class.
export class Asset extends EventEmitter {

  constructor(name) {
    super();
    
    this.name = name;
    this.state = STATE.WAITING;

    // Inheritors of `Asset` that can change state willy-nilly should set this to `true`.
    this.can_move_backwards = false;
  }

  setState(state) {
    if(this.state === state) {
      return;
    }
    
    Logger.info(`Asset '${this.name}' state is moving from '${this.state}' to '${state}'`);
    
    if(this.isDoneLoading() && !this.can_move_backwards) {
      Logger.warn(`Asset '${this.name}' state is moving from '${this.state}' to '${state}', but it's already loaded.`);
    }
    
    this.state = state;
    
    this.emit('statechange', {
      previous: this.state,
      state: state,
      asset: this
    });
  }

  isLoaded() {
    return this.state === STATE.LOAD_COMPLETE;
  }

  isLoading() {
    return this.state === STATE.LOADING;
  }

  // Returns `true` if this asset is either loaded or had an error while loading.
  isDoneLoading() {
    return this.isLoaded() || this.state === STATE.LOAD_ERROR;
  }

  // Returns the state of a hypothetical loader containing `assets`.
  getCombinedState(assets) {
    let state = STATE.LOAD_COMPLETE;

    // If we have no assets, we're done.
    if(assets.length === 0) {
      return state;
    }
    
    for(let asset of assets) {
      if(asset.state === STATE.LOAD_ERROR) {
        continue;
      }
      
      state = Math.min(state, asset.state);
    }
    
    return state;
  }
  
}

// # `Loader`
//
// Handles events for assets.
export default class Loader extends Asset {
  
  constructor(name) {
    super(name);
    
    this.assets = {};

    this.can_move_backwards = true;
    
    this.handleAssetStateChange = this.handleAssetStateChange.bind(this);
  }

  addAsset(name, asset) {
    //this.emit('loaded', this);

    this.assets[name] = asset;

    asset.on('statechange', this.handleAssetStateChange);

    this.updateState();
  }

  getAsset(name) {
    return this.assets[name];
  }

  hasAsset(name) {
    return name in this.assets;
  }

  // Returns the internal key-value list of all assets.
  getAllAssets() {
    return this.assets;
  }

  handleAssetStateChange(event) {
    this.emit('childstatechange', {
      previous: event.previous,
      state: event.state,
      asset: event.asset,
      loader: this
    });
    
    this.updateState();
  }

  updateState() {
    this.setState(this.getCombinedState(Object.values(this.assets)));
  }
  
}
