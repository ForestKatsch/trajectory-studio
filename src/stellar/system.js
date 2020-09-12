
import Logger from 'js-logger';

import Orbit from './orbit.js';
import Body from './body.js';

export default class System {

  constructor() {
    this.root = new Body('@root');

    this.root.system = this;

    this.bodies = {};
  }

  // Adds the body to this list of bodies. Used for fast lookup.
  _addBody(body) {
    if(body.name in this.bodies) {
      Logger.warn(`This stellar system already has a body named '${body.name}'!`);
      return;
    }

    this.bodies[body.name] = body;
  }

  getBody(name) {
    return this.bodies[name];
  }
  
}

export class SolarSystem extends System {

  constructor() {
    super();
  }
  
}
