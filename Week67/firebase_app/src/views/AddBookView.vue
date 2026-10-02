<template>
    <div>
        <Booklist ref="bookListRef" />
    </div>
    <div>
        <h1>Adding a new book</h1>
        <p v-if="successMessage" role="status" class="text-success">{{ successMessage }}</p>
        <p v-if="errorMessage" role="alert" class="text-danger">{{ errorMessage }}</p>
        <form @submit.prevent="addBook">
            <div>
                <label for="isbn">ISBN:</label>
                <input type="text" v-model="isbn" id="isbn" required :disabled="isAdding">
            </div>
            <div>
                <label for="name">NAME:</label>
                <input type="text" v-model="name" id="name" required :disabled="isAdding">
            </div>
            <button type="submit" :disabled="isAdding">{{ isAdding ? 'Adding...' : 'Add Book!' }}</button>
        </form>
    </div>
</template>

<script setup>
import { ref } from 'vue';
import db from '../firebase/init.js';
import { collection, addDoc } from 'firebase/firestore';
import Booklist from '@/components/Booklist.vue';

const isbn = ref("");
const name = ref("");
const bookListRef = ref(null);
const isAdding = ref(false);
const successMessage = ref('');
const errorMessage = ref('');

const addBook = async () => {
    if (isAdding.value) return;
    successMessage.value = '';
    errorMessage.value = '';

    const newBook = { isbn: isbn.value.trim(), name: name.value.trim() };
    if (!newBook.name || !newBook.isbn) {
        errorMessage.value = 'Name and ISBN are required.';
        return;
    }
    if (Number.isNaN(Number(newBook.isbn))) {
        errorMessage.value = 'ISBN must be a number.';
        return;
    }

    isAdding.value = true;

    try {
        await addDoc(collection(db, "books"), newBook);

        isbn.value = '';
        name.value = '';
        successMessage.value = 'Book added successfully.';
    } catch (error) {
        console.error("Add Failed: " + error)
        errorMessage.value = 'Failed to add the book. Please try again.';
        return;
    } finally {
        isAdding.value = false;
    }
    await bookListRef.value?.refreshBooks();
}
</script>
