<template>
    <div>
        <h1>Adding a new book</h1>
        <form @submit.prevent="addBook">
            <div>
                <label for="isbn">ISBN:</label>
                <input type="text" v-model="isbn" id="isbn" required>
            </div>
            <div>
                <label for="name">NAME:</label>
                <input type="text" v-model="name" id="name" required>
            </div>
            <button type="submit">Add Book!</button>
        </form>
    </div>
</template>

<script setup>
import { ref } from 'vue';
import db from '../firebase/init.js';
import { collection, addDoc } from 'firebase/firestore';

const isbn = ref("");
const name = ref("");

const addBook = async () => {
    try {
        const isbnNum = Number(isbn.value);
        if (isNaN(isbnNum)) {
            alert("isbn must be an number!")
            return;
        }

        await addDoc(collection(db, "books"), {
            isbn: isbn.value,
            name: name.value
        });

        isbn.value = '';
        name.value = '';
        alert("add successful!")
    } catch (error) {
        console.error("Add Failed: " + error)
    }
}
</script>
