
import {vec3} from 'gl-matrix';
import Orbit from './orbit.js';

export default class Body {

  constructor(name) {
    this.system = null;

    this.position = vec3.create();
    
    this.orbit = new Orbit(name);

    this.parent = null;

    this.moons = [];
  }

  add(body) {
    this.moons.push(body);

    body.setParent(this);

    this.system.addBody(body);
  }

  setParent(parent) {
    this.parent = parent;
    this.system = parent.system;
  }

  update() {
    this.moons.forEach((moon) => {
      moon.update();
    });
  }
  
}
