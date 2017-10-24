import React from 'react';
import PropTypes from 'prop-types';
import { connect } from "react-redux";
import AddBook from '../utils/AddBook';
import {allBooksSelector} from '../../reducers/books';

const HomePage = ({ books }) => (
  <div>
    {books.length === 0 && <AddBook/>}
  </div>
);


HomePage.propTypes = {
  books: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired
    }).isRequired
  ).isRequired
};

function mapStateToProps(state) {
  return {
    books: allBooksSelector(state)
  };
}

export default connect(mapStateToProps)(HomePage);
