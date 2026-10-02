<template>
    <div>
        <h1>Books</h1>
        <div class="d-flex flex-wrap align-items-center gap-3 mb-3">
            <label>
                Order by:
                <select v-model="sortField" @change="fetchBooks">
                    <option value="name">Name</option>
                    <option value="isbn">ISBN</option>
                </select>
            </label>
            <label>
                Limit:
                <select v-model.number="resultLimit" @change="fetchBooks">
                    <option :value="0">All</option>
                    <option :value="5">5</option>
                    <option :value="10">10</option>
                    <option :value="20">20</option>
                    <option :value="50">50</option>
                </select>
            </label>
        </div>
        <p v-if="errorMessage" role="alert" class="text-danger">{{ errorMessage }}</p>
        <p v-if="isLoading" role="status">Loading books...</p>
        <p v-else-if="books.length === 0 && !errorMessage">No books found.</p>
        <ul>
            <li v-for="book in books" :key="book.id" class="mb-2">
                <form v-if="editForms[book.id]" @submit.prevent="saveBook(book.id)"
                    class="d-inline-flex flex-wrap align-items-center gap-2">
                    <label>
                        Name:
                        <input v-model="editForms[book.id].name" type="text" required :disabled="pendingBookIds.has(book.id)">
                    </label>
                    <label>
                        ISBN:
                        <input v-model="editForms[book.id].isbn" type="text" required :disabled="pendingBookIds.has(book.id)">
                    </label>
                    <button type="submit" :disabled="pendingBookIds.has(book.id)">
                        {{ pendingBookIds.has(book.id) ? 'Saving...' : 'Save' }}
                    </button>
                    <button type="button" @click="cancelEdit(book.id)" :disabled="pendingBookIds.has(book.id)">Cancel</button>
                </form>
                <template v-else>
                    {{ book.name }} (ISBN: {{ book.isbn }})
                    <button type="button" @click="startEdit(book)"
                        :disabled="pendingBookIds.has(book.id)">Edit</button>
                    <button type="button" @click="deleteBook(book.id)" :disabled="pendingBookIds.has(book.id)">
                        {{ pendingBookIds.has(book.id) ? 'Deleting...' : 'Delete' }}
                    </button>
                </template>
            </li>
        </ul>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import db from '../firebase/init.js';
import { collection, query, orderBy, limit, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';

defineOptions({ name: 'BookList' });

const books = ref([]);
const editForms = ref({});
const pendingBookIds = ref(new Set());
const errorMessage = ref('');
const sortField = ref('name');
const resultLimit = ref(0);
const isLoading = ref(false);
let latestRequestId = 0;

const fetchBooks = async () => {
    const requestId = ++latestRequestId;
    isLoading.value = true;
    errorMessage.value = '';

    try {
        const constraints = [orderBy(sortField.value, 'asc')];
        if (resultLimit.value > 0) {
            constraints.push(limit(resultLimit.value));
        }
        const q = query(collection(db, 'books'), ...constraints);
        const querySnapshot = await getDocs(q);
        const booksArray = [];
        querySnapshot.forEach((doc) => {
            booksArray.push({ ...doc.data(), id: doc.id });
        });
        // A slower, older query must not overwrite the latest selection.
        if (requestId === latestRequestId) {
            books.value = booksArray;
        }
    } catch (error) {
        console.error('Fetch Failed:', error);
        if (requestId === latestRequestId) {
            errorMessage.value = 'Failed to load books. Please refresh and try again.';
        }
    } finally {
        if (requestId === latestRequestId) {
            isLoading.value = false;
        }
    }
}

defineExpose({ refreshBooks: fetchBooks });

const startEdit = (book) => {
    if (pendingBookIds.value.has(book.id) || editForms.value[book.id]) return;

    editForms.value[book.id] = {
        name: String(book.name ?? ''),
        isbn: String(book.isbn ?? '')
    };
    errorMessage.value = '';
};

const cancelEdit = (bookId) => {
    if (pendingBookIds.value.has(bookId)) return;

    delete editForms.value[bookId];
    errorMessage.value = '';
};

const saveBook = async (bookId) => {
    if (pendingBookIds.value.has(bookId) || !editForms.value[bookId]) return;

    const changes = {
        name: editForms.value[bookId].name.trim(),
        isbn: editForms.value[bookId].isbn.trim()
    };

    if (!changes.name || !changes.isbn) {
        errorMessage.value = 'Name and ISBN are required.';
        return;
    }

    pendingBookIds.value.add(bookId);
    errorMessage.value = '';

    try {
        await updateDoc(doc(db, 'books', bookId), changes);
        books.value = books.value.map((book) => book.id === bookId ? { ...book, ...changes } : book);
        delete editForms.value[bookId];
    } catch (error) {
        console.error('Update Failed:', error);
        errorMessage.value = 'Failed to save the book. Please try again.';
        return;
    } finally {
        pendingBookIds.value.delete(bookId);
    }
    await fetchBooks();
};

const deleteBook = async (bookId) => {
    if (pendingBookIds.value.has(bookId)) return;

    pendingBookIds.value.add(bookId);
    errorMessage.value = '';

    try {
        await deleteDoc(doc(db, 'books', bookId));
        books.value = books.value.filter((book) => book.id !== bookId);
        delete editForms.value[bookId];
    } catch (error) {
        console.error('Delete Failed:', error);
        errorMessage.value = 'Failed to delete the book. Please try again.';
        return;
    } finally {
        pendingBookIds.value.delete(bookId);
    }
    await fetchBooks();
};

onMounted(() => {
    fetchBooks();
});
</script>
