import React from 'react';

import PropTypes from 'prop-types';
import { Route } from "react-router-dom";
import TopNavigationMenu from './components/navigation/TopNavigationMenu';
import HomePage from './components/pages/HomePage'
import NewBookPage from './components/pages/NewBookPage'

const App = ({ location }) =>
<div className="ui container">
  <TopNavigationMenu/>
  <Route location={location} path="/" exact component={HomePage} />
  <Route location={location} path="/books/new" exact component={NewBookPage} />
</div>

App.propTypes = {
  location: PropTypes.shape({
    pathname: PropTypes.string.isRequired
  }).isRequired
};

export default App;
