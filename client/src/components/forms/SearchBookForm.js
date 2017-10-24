import React, { Component } from 'react';
import { Form, Dropdown } from 'semantic-ui-react';
import axios from 'axios';

class SearchBookForm extends Component {

  state = {
    loading: false,
    query: '',
    options: [],
    book: {}
  }

  onSearchChange = (e, data) => {
    clearTimeout(this.timer);
    this.setState({
      query: data.searchQuery
    });
    this.timer = setTimeout(this.fetchOptions, 1000);
  }

  fetchOptions = () =>{
    if (!this.state.query) return;
    this.setState({
      loading: true
    });
    axios.get(`/api/books/find?q=${this.state.query}`)
    .then(res => res.data.books)
    .then(books => {
      const options = [];
      const booksObject = [];
      books.forEach(book => {
        console.log(book.book_id);
        booksObject[book.book_id] = book;
        options.push({
          key: book.book_id,
          value: book.book_id,
          image: { avatar: true, src: book.cover },
          text: book.title
        })
      })
      this.setState({
        loading: false,
        options,
        books: booksObject
      });
    })
  }

  render() {
    return (
      <Form>
        <Dropdown
          search
          fluid
          placeholder="Find a book"
          value={this.state.query}
          onSearchChange={this.onSearchChange}
          options={this.state.options}
          loading={this.state.loading}

        />
      </Form>
    );
  }

}

export default SearchBookForm;
