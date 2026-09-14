import { Router } from 'express'
import { getAllSets, getSingleSet } from '../controllers/setsController.js'

const router = Router()

router.get('/', getAllSets)
router.get('/:id', getSingleSet)

export default router