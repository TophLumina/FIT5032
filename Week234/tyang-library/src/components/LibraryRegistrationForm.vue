<template>
    <div class="container mt-5 registration-page">
        <div class="row">
            <div class="col-md-8 offset-md-2 registration-column">
                <h1 class="text-center">User Information Form</h1>
                <form class="registration-form" @submit.prevent="submitForm">
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <label for="username" class="form-label">Username</label>
                            <input type="text" class="form-control" id="username" @blur="() => validateName(true)"
                                @input="() => validateName(false)" v-model="formData.username">
                            <div v-if="errors.username" class="text-danger">{{ errors.username }}</div>
                        </div>

                        <div class="col-md-6">
                            <label for="password" class="form-label">Password</label>
                            <input type="password" class="form-control" id="password"
                                @blur="() => validatePassword(true)" @input="() => validatePassword(false)"
                                v-model="formData.password">
                            <div v-if="errors.password" class="text-danger">{{ errors.password }}</div>
                        </div>
                    </div>

                    <div class="row mb-3">
                        <div class="col-md-6">
                            <div class="form-check">
                                <input type="checkbox" class="form-check-input" id="isAustralian"
                                    @blur="() => validateAustralian(true)" @change="() => validateAustralian(false)"
                                    v-model="formData.isAustralian">
                                <label class="form-check-label" for="isAustralian">Australian Resident?</label>
                            </div>
                            <div v-if="errors.isAustralian" class="text-danger">{{ errors.isAustralian }}</div>
                        </div>
                        <div class="col-md-6">
                            <label for="gender" class="form-label">Gender</label>
                            <select class="form-select" id="gender" @blur="() => validateGender(true)"
                                @change="() => validateGender(false)" v-model="formData.gender">
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                            </select>
                            <div v-if="errors.gender" class="text-danger">{{ errors.gender }}</div>
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

                <div v-if="submittedCards.length" class="mt-5 submissions">
                    <DataTable
                        :value="submittedCards"
                        stripedRows
                        showGridlines
                        :tableStyle="{ minWidth: '50rem' }"
                    >
                        <Column field="username" header="Username" />
                        <Column field="password" header="Password" />
                        <Column header="Australian Resident">
                            <template #body="{ data }">
                                {{ data.isAustralian ? 'Yes' : 'No' }}
                            </template>
                        </Column>
                        <Column field="gender" header="Gender" />
                        <Column field="reason" header="Reason" />
                    </DataTable>
                </div>

            </div>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';

const formData = ref({
    username: '',
    password: '',
    isAustralian: null,
    reason: '',
    gender: ''
});

const submittedCards = ref([]);

const submitForm = () => {
    validateForm();
    if (!errors.value.username && !errors.value.password && !errors.value.gender && !errors.value.isAustralian) {
        submittedCards.value.push({
            ...formData.value
        });
        clearForm();
    }
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

const errors = ref({
    username: null,
    password: null,
    isAustralian: null,
    reason: null,
    gender: null,
});

const validateName = (blur) => {
    if (formData.value.username.length < 3) {
        if (blur) errors.value.username = 'Name must be at least 3 characters.';
    } else {
        errors.value.username = null;
    }
}

const validatePassword = (blur) => {
    const password = formData.value.password;
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength) {
        if (blur) errors.value.password = 'Password must be at least 8 characters long.';
    } else if (!hasUpperCase) {
        if (blur) errors.value.password = 'Password must contain at least one uppercase letter.';
    } else if (!hasLowerCase) {
        if (blur) errors.value.password = 'Password must contain at least one lowercase letter.';
    } else if (!hasNumber) {
        if (blur) errors.value.password = 'Password must contain at least one number.';
    } else if (!hasSpecialChar) {
        if (blur) errors.value.password = 'Password must contain at least one special character.';
    } else {
        errors.value.password = null;
    }
}

const validateGender = (blur) => {
    if (!formData.value.gender) {
        if (blur) errors.value.gender = 'Please select a gender.';
    } else {
        errors.value.gender = null;
    }
}

const validateAustralian = (blur) => {
    if (formData.value.isAustralian === null) {
        if (blur) errors.value.isAustralian = 'Please indicate if you are an Australian resident.';
    } else {
        errors.value.isAustralian = null;
    }
}

const validateForm = () => {
    validateName(true);
    validatePassword(true);
    validateGender(true);
    validateAustralian(true);
}
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

.submissions {
    width: 100%;
    overflow-x: auto;
}

/* Tablet: use the available width while keeping the two-column form. */
@media (min-width: 768px) and (max-width: 991.98px) {
    .registration-column {
        flex: 0 0 100%;
        max-width: 100%;
        margin-left: 0;
    }
}

/* Mobile: Bootstrap stacks the fields; these rules refine spacing and the table. */
@media (max-width: 767.98px) {
    .registration-page {
        margin-top: 1.5rem !important;
        padding-right: 1rem;
        padding-left: 1rem;
    }

    .registration-form>.row>.col-md-6+.col-md-6 {
        margin-top: 1rem;
    }

    .submissions {
        margin-top: 2rem !important;
    }
}

/* Small phones: give each action a full-width, touch-friendly target. */
@media (max-width: 575.98px) {
    h1 {
        font-size: 2rem;
    }

    .registration-form>.text-center {
        display: grid;
        gap: 0.75rem;
    }

    .registration-form>.text-center .btn {
        width: 100%;
        margin: 0 !important;
    }
}
</style>
