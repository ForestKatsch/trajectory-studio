
import React from 'react';

import './Button.css';

class Button extends React.Component {
  
  constructor(props) {
    super(props);

    this.handleClick = this.handleClick.bind(this);
  }

  handleClick() {
    if('onClick' in this.props) {
      this.props.onClick(this);
    }
  }

  render() {
    return (
      <button className="Button" onClick={this.handleClick}>
        <span className="Button__label">{this.props.label}</span>
      </button>
    );
  }
}

export default Button;
