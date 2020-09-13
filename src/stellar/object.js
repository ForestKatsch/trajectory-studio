
import {vec3} from 'gl-matrix';
import Orbit from './orbit.js';

export default class StellarObject {

  constructor(name) {
    this.name = name;

    this.system = null;

    this.parent = null;
    this.children = [];

    this.orbit = new Orbit(name);

    // Updated within `update`.
    this.position = vec3.create();

    // The radius of this object.
    this.radius = 0;

    this.object_info = {
      
    };

    this.render_info = {

    };
  }

  setRenderInfo(info) {
    this.render_info = {
      ...this.render_info,
      ...info
    };

    return this;
  }

  add(object) {
    this.children.push(object);

    object._setParent(this);
  }

  _setParent(parent) {
    this.parent = parent;
    this.system = parent.system;
  }

  setRadius(radius) {
    this.radius = radius;

    return this;
  }

  setOrbit(orbit) {
    this.orbit = orbit;

    return this;
  }

  update() {
    vec3.copy(this.position, this.orbit.getPositionAtTime(Date.now() / 1000));

    if(this.parent) {
      vec3.add(this.position, this.position, this.parent.position);
    }
    
    this.children.forEach((child) => {
      child.update();
    });
  }

  addToSystem(system) {
    this.system = system;
    
    this.system._addObject(this);
    
    this.children.forEach((child) => {
      child.addToSystem(system);
    });
  }
  
}

export class StellarObjectStar extends StellarObject {

  constructor(name) {
    super(name);
  }
  
}

export class StellarObjectPlanet extends StellarObject {

  constructor(name) {
    super(name);

    this.setRenderInfo({
      textures: {
        color: null,
        landinfo: null,
        normal: null,
      },
      
      atmosphere: false,
    });
  }
  
}
