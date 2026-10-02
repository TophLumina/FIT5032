<template>
    <h1>Signin</h1>
    <p><input type="text" placeholder="E-mail" v-model="email"></p>
    <p><input type="text" placeholder="Password" v-model="password"></p>
    <p><button @click="signin">Signin</button></p>
</template>

<script setup>
import { ref } from "vue"
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "vue-router";

const email = ref("")
const password = ref("")
const router = useRouter()
const auth = getAuth()

const signin = () => {
    signInWithEmailAndPassword(auth, email.value, password.value)
        .then((data) => {
            console.log("FireBase Signin Successful!")
            router.push("/")
            console.log(auth.currentUser)
        }).catch((error) => {
            console.log(error.code)
        })

}
</script>