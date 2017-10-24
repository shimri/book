import React, { Component } from 'react';
import { Segment } from "semantic-ui-react";
import SearchBookForm from "../forms/SearchBookForm";

class NewBookPage extends Component {

  state = {
    book: null
  }

  render() {
    return (
      <Segment>
           <h1>Add new book to your collection</h1>
           <SearchBookForm/>
       </Segment>
    );
  }

}

export default NewBookPage;
