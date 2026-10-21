import './assets/main.css'
import 'primeicons/primeicons.css'

import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Dialog from 'primevue/dialog'
import Drawer from 'primevue/drawer'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import MultiSelect from 'primevue/multiselect'
import ProgressBar from 'primevue/progressbar'
import ProgressSpinner from 'primevue/progressspinner'
import RadioButton from 'primevue/radiobutton'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import App from './App.vue'

const app = createApp(App)

app.use(PrimeVue, {
	theme: {
		preset: Aura,
		options: {
			darkModeSelector: false
		}
	}
})


app.component('Button', Button)
app.component('Card', Card)
app.component('Dialog', Dialog)
app.component('Drawer', Drawer)
app.component('InputText', InputText)
app.component('Message', Message)
app.component('MultiSelect', MultiSelect)
app.component('ProgressBar', ProgressBar)
app.component('ProgressSpinner', ProgressSpinner)
app.component('RadioButton', RadioButton)
app.component('Select', Select)
app.component('Skeleton', Skeleton)
app.component('Tag', Tag)
app.component('Textarea', Textarea)

app.mount('#app')
