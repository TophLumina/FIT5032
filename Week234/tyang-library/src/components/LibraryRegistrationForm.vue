<template>
    <div class="container mt-5 registration-page">
        <div class="row">
            <div class="col-md-8 offset-md-2 registration-column">
                <h1 class="text-center">User Information Form</h1>
                <form class="registration-form" @submit.prevent="submitForm">
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <label for="username" class="form-label">Username</label>
                            <input type="text" class="form-control" id="username" v-model="formData.username">
                        </div>

                        <div class="col-md-6">
                            <label for="password" class="form-label">Password</label>
                            <input type="password" class="form-control" id="password" v-model="formData.password">
                        </div>
                    </div>

                    <div class="row mb-3">
                        <div class="col-md-6">
                            <div class="form-check">
                                <input type="checkbox" class="form-check-input" id="isAustralian"
                                    v-model="formData.isAustralian">
                                <label class="form-check-label" for="isAustralian">Australian Resident?</label>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label for="gender" class="form-label">Gender</label>
                            <select class="form-select" id="gender" v-model="formData.gender">
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>

                    <div class="mb-3">
                        <label for="reason" class="form-label">Reason for joining</label>
                        <textarea class="form-control" id="reason" rows="3" v-model="formData.reason"></textarea>
                    </div>

                    <div class="text-center">
                        <button type="submit" class="me-2 btn btn-primary">Submit</button>
                        <button type="button" class="btn btn-secondary" @click="clearForm">Clear</button>
                    </div>
                </form>

                <div class="row mt-5 submissions" v-if="submittedCards.length">
                    <div class="d-flex flex-wrap justify-content-start card-grid">
                        <div v-for="(card, index) in submittedCards" :key="index" class="card submission-card">
                            <div class="card-header">
                                User Information
                            </div>
                            <ul class="list-group list-group-flush">
                                <li class="list-group-item">Username: {{ card.username }}</li>
                                <li class="list-group-item">Password: {{ card.password }}</li>
                                <li class="list-group-item">Australian Resident: {{ card.isAustralian ? 'Yes' : 'No' }}
                                </li>
                                <li class="list-group-item">Gender: {{ card.gender }}</li>
                                <li class="list-group-item">Reason: {{ card.reason }}</li>
                            </ul>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';

const formData = ref({
    username: '',
    password: '',
    isAustralian: false,
    reason: '',
    gender: ''
});

const submittedCards = ref([]);

const submitForm = () => {
    submittedCards.value.push({
        ...formData.value
    });
};

const clearForm = () => {
    formData.value = {
        username: '',
        password: '',
        isAustralian: false,
        reason: '',
        gender: ''
    };
};
</script>

<style scoped>
.registration-page {
    width: 100%;
    padding-bottom: 2rem;
}

.registration-column {
    min-width: 0;
}

h1 {
    margin-bottom: 1.5rem;
    font-size: clamp(2rem, 5vw, 3.5rem);
}

.form-control,
.form-select,
.btn {
    min-height: 44px;
}

.card-grid {
    width: 100%;
    gap: 1rem;
}

.card {
    border: 1px solid #ccc;
    border-radius: 10px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.submission-card {
    flex: 0 1 18rem;
    width: 18rem;
    min-width: 0;
    overflow: hidden;
}

.card-header {
    background-color: #275FDA;
    color: white;
    padding: 10px;
    border-radius: 10px 10px 0 0;
}

.list-group-item {
    padding: 10px;
    overflow-wrap: anywhere;
}

/* Tablet: use the available width while keeping the two-column form. */
@media (min-width: 768px) and (max-width: 991.98px) {
    .registration-column {
        flex: 0 0 100%;
        max-width: 100%;
        margin-left: 0;
    }

    .submission-card {
        flex-basis: calc(50% - 0.5rem);
        width: calc(50% - 0.5rem);
    }
}

/* Mobile: Bootstrap stacks the fields; these rules refine spacing and cards. */
@media (max-width: 767.98px) {
    .registration-page {
        margin-top: 1.5rem !important;
        padding-right: 1rem;
        padding-left: 1rem;
    }

    .registration-form > .row > .col-md-6 + .col-md-6 {
        margin-top: 1rem;
    }

    .submissions {
        margin-top: 2rem !important;
    }

    .card-grid {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr);
    }

    .submission-card {
        width: 100%;
    }
}

/* Small phones: give each action a full-width, touch-friendly target. */
@media (max-width: 575.98px) {
    h1 {
        font-size: 2rem;
    }

    .registration-form > .text-center {
        display: grid;
        gap: 0.75rem;
    }

    .registration-form > .text-center .btn {
        width: 100%;
        margin: 0 !important;
    }
}
</style>
