const express = require('express');
const Payment = require('../models/Payment');
const Rental = require('../models/Rental');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Create Payment
router.post('/', protect, async (req, res) => {
  try {
    const { rentalId, amount, paymentMethod, transactionId, paymentType } = req.body;

    if (!rentalId || !amount || !paymentMethod || !transactionId || !paymentType) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    const rental = await Rental.findById(rentalId);
    if (!rental) {
      return res.status(404).json({ success: false, message: 'Rental not found' });
    }

    if (rental.customer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to make payment for this rental' });
    }

    const payment = new Payment({
      rental: rentalId,
      customer: req.user.id,
      amount,
      paymentMethod,
      transactionId,
      paymentType,
      status: 'completed',
    });

    await payment.save();

    // Update rental payment status
    if (paymentType === 'rental' && amount === rental.rentalPrice) {
      rental.paymentStatus = 'paid';
    } else if (paymentType === 'deposit' && amount === rental.depositAmount) {
      rental.paymentStatus = 'paid';
    }

    rental.status = 'confirmed';
    await rental.save();

    res.status(201).json({
      success: true,
      message: 'Payment processed successfully',
      data: payment,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Payment History
router.get('/', protect, async (req, res) => {
  try {
    const payments = await Payment.find({ customer: req.user.id })
      .populate('rental')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Payment by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id).populate('rental');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    if (payment.customer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this payment' });
    }

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Refund Payment
router.post('/:id/refund', protect, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    if (payment.customer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to refund this payment' });
    }

    payment.status = 'refunded';
    await payment.save();

    // Update rental payment status
    const rental = await Rental.findById(payment.rental);
    rental.paymentStatus = 'refunded';
    await rental.save();

    res.status(200).json({
      success: true,
      message: 'Payment refunded successfully',
      data: payment,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;