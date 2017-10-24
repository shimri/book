import express from 'express'

const router = express.Router();

router.get("/find", (req,res) =>{
  res.json({
    books: [
      {
          book_id: "3589685",
          title: "Your Safari Dragons: In Search of the Real Komodo Dragon",
          author_lf: "White, Daniel",
          author_fl: "Daniel White",
          author_code: "whitedaniel",
          ISBN: "1595940146",
          ISBN_cleaned: "1595940146",
          publicationdate: "2005",
          entry_date: "Jun 14, 2006",
          rating: 4,
          language_main: "eng",
          dateacquired_date: "Dec 31, 1969",
          cover: "http://ecx.images-amazon.com/images/P/1595940146.01._SCLZZZZZZZ_.jpg",
          pages: 200
      },
      {
          book_id: "30966619",
          title: "Zeus: A Journey Through Greece in the Footsteps of a God",
          author_lf: "Stone, Tom",
          author_fl: "Tom Stone",
          author_code: "stonetom",
          ISBN: "158234518X",
          ISBN_cleaned: "158234518X",
          publicationdate: "2008",
          entry_date: "Jun 15, 2008",
          rating: 4,
          language_main: "eng",
          dateacquired_date: "Dec 31, 1969",
          cover: "http://ecx.images-amazon.com/images/P/158234518X.01._SCLZZZZZZZ_.jpg",
          pages: 45
        },
        {
          book_id: "39285978",
          title: "Zona disagio",
          author_lf: "Franzen, Jonathan",
          author_fl: "Jonathan Franzen",
          author_code: "franzenjonathan",
          ISBN: "8806193112",
          ISBN_cleaned: "8806193112",
          publicationdate: "Dec 1, 2004",
          entry_date: "Dec 16, 2008",
          rating: 0,
          language_main: "eng",
          dateacquired_date: "Dec 31, 1969",
          cover: "http://ecx.images-amazon.com/images/P/8806193112.01._SCLZZZZZZZ_.jpg",
          pages:500
        },
        {
          book_id: "41601804",
          title: "Zarafa: a giraffe's true story, from deep in Africa to the heart of Paris",
          author_lf: "Allin, Michael",
          author_fl: "Michael Allin",
          author_code: "allinmichael",
          ISBN: "0802713394",
          ISBN_cleaned: "0802713394",
          publicationdate: "1998",
          entry_date: "Feb 11, 2009",
          rating: 0,
          language_main: "eng",
          dateacquired_date: "Dec 31, 1969",
          cover: "http://ecx.images-amazon.com/images/P/0802713394.01._SCLZZZZZZZ_.jpg",
          pages: 90
        },
        {
          book_id: "79141967",
          title: "Ysabel",
          author_lf: "Kay, Guy Gavriel",
          author_fl: "Guy Gavriel Kay",
          author_code: "kayguygavriel",
          ISBN: "0143016695",
          ISBN_cleaned: "0143016695",
          publicationdate: "2007",
          entry_stamp: "1318989423",
          entry_date: "Oct 18, 2011",
          rating: 0,
          language_main: "heb",
          dateacquired_date: "Dec 31, 1969",
          cover: "http://ecx.images-amazon.com/images/P/0143016695.01._SCLZZZZZZZ_.jpg",
          pages:67
        },
        {
          book_id: "112618928",
          title: "Ἡροδότου Ἁλικαρνησσέος ἱστορίης ἀπόδεξις",
          author_lf: "Ἡρόδοτος",
          author_fl: "Ἡρόδοτος",
          author_code: "4073570986",
          ISBN: "",
          ISBN_cleaned: "",
          publicationdate: "?",
          entry_stamp: "1411067736",
          entry_date: "Sep 18, 2014",
          rating: 0,
          language_main: "rus",
          dateacquired_date: "Dec 31, 1969",
          cover: "http://pics.cdn.librarything.com/picsizes/de/5b/de5beef9b5ceff2597959414141414141414141.jpg",
          pages: 55
        },
        {
          book_id: "118889679",
          title: "Young Frankenstein",
          author_lf: "Wilder, Gene",
          author_fl: "Gene Wilder",
          author_code: "wildergene",
          ISBN: "",
          ISBN_cleaned: "",
          publicationdate: "?",
          entry_stamp: "1433355834",
          entry_date: "Jun 3, 2015",
          rating: 0,
          language_main: "eng",
          dateacquired_date: "Dec 31, 1969",
          cover: "http://ecx.images-amazon.com/images/I/51KDmdUemhL._SCLZZZZZZZ_.jpg",
          pages:456
        },
        {
          book_id: "118889688",
          title: "Young Frankenstein",
          author_lf: "Wilder, Gene",
          author_fl: "Gene Wilder",
          author_code: "wildergene",
          ISBN: "",
          ISBN_cleaned: "",
          publicationdate: "2006",
          entry_stamp: "1433355867",
          entry_date: "Jun 3, 2015",
          rating: 0,
          language_main: "eng",
          dateacquired_date: "Dec 31, 1969",
          cover: "http://ecx.images-amazon.com/images/P/B000G6BLWE.01._SCLZZZZZZZ_.jpg",
          pages: 678
        },
        {
          book_id: "124471069",
          title: "Zeus : a journey through Greece in the footsteps of a god",
          author_lf: "Stone, Tom",
          author_fl: "Tom Stone",
          author_code: "stonetom",
          ISBN: "9781582345185",
          ISBN_cleaned: "158234518X",
          publicationdate: "2008",
          entry_stamp: "1450993117",
          entry_date: "Dec 24, 2015",
          rating: 0,
          language_main: "eng",
          dateacquired_date: "Dec 31, 1969",
          cover: "http://ecx.images-amazon.com/images/P/158234518X.01._SCLZZZZZZZ_.jpg",
          pages: 345
        }
    ]
  })
});


export default router
