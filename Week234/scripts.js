document.addEventListener('DOMContentLoaded', function() {
    const books = [
        'To Kill a Mockingbird by Harper Lee',
        '1984 by George Orwell',
        'Harry Potter and the Sorcerer\'s Stone by J.K. Rowling',
        'The Lord of the Rings by J.R.R. Tolkien',
        'The Great Gatsby by F. Scott Fitzgerald'
    ];

    const bookList = document.getElementById('book-list');

    books.forEach(function(book) {
        const li = document.createElement('li');
        li.textContent = book;
        bookList.appendChild(li);
    });
});
