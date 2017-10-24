import React, { Component } from 'react';
import { Menu } from 'semantic-ui-react';
import { Link } from 'react-router-dom';

export default class TopNavigationMenu extends Component {
  state = { activeItem: 'home' }

  handleItemClick = (e, { name }) => this.setState({ activeItem: name })

  render() {
    const { activeItem } = this.state

    return (
      <Menu secondary pointing>
        <Menu.Item as={Link} to="/" name='home' active={activeItem === 'home'} onClick={this.handleItemClick} />
        <Menu.Item as={Link} to="/add_new_book" name='add' active={activeItem === 'add'} onClick={this.handleItemClick} />
      </Menu>
    )
  }
}


TopNavigationMenu.propTypes = {

}
