const express = require('express');
const Rental = require('../models/Rental');
const Item = require('../models/Item');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Create Rental
router.post('/', protect, async (req, res) => {
  try {
    const { itemId, startDate, endDate, deliveryAddress } = req.body;

    if (!itemId || !startDate || !endDate || !deliveryAddress) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    if (item.stock < 1) {
      return res.status(400).json({ success: false, message: 'Item not available' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    if (days < 1) {
      return res.status(400).json({ success: false, message: 'Invalid rental period' });
    }

    const rentalPrice = item.rentPrice * days;
    const totalAmount = rentalPrice + item.depositAmount;

    const rental = new Rental({
      item: itemId,
      customer: req.user.id,
      vendor: item.vendor,
      startDate,
      endDate,
      rentalPrice,
      depositAmount: item.depositAmount,
      totalAmount,
      deliveryAddress,
    });

    await rental.save();

    res.status(201).json({
      success: true,
      message: 'Rental created successfully',
      data: rental,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Rentals
router.get('/', protect, async (req, res) => {
  try {
    const query = {};

    if (req.user.role === 'customer') {
      query.customer = req.user.id;
    } else if (req.user.role === 'vendor') {
      query.vendor = req.user.id;
    }

    const rentals = await Rental.find(query)
      .populate('item')
      .populate('customer', 'firstName lastName email')
      .populate('vendor', 'firstName lastName email')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: rentals.length,
      data: rentals,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Rental by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const rental = await Rental.findById(req.params.id)
      .populate('item')
      .populate('customer')
      .populate('vendor');

    if (!rental) {
      return res.status(404).json({ success: false, message: 'Rental not found' });
    }

    if (rental.customer.toString() !== req.user.id && rental.vendor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to view this rental' });
    }

    res.status(200).json({
      success: true,
      data: rental,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update Rental Status
router.put('/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;

    let rental = await Rental.findById(req.params.id);

    if (!rental) {
      return res.status(404).json({ success: false, message: 'Rental not found' });
    }

    if (rental.vendor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this rental' });
    }

    rental = await Rental.findByIdAndUpdate(req.params.id, { status }, { new: true });

    res.status(200).json({
      success: true,
      message: 'Rental status updated successfully',
      data: rental,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Cancel Rental
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const rental = await Rental.findById(req.params.id);

    if (!rental) {
      return res.status(404).json({ success: false, message: 'Rental not found' });
    }

    if (rental.customer.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this rental' });
    }

    if (rental.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Can only cancel pending rentals' });
    }

    rental.status = 'cancelled';
    await rental.save();

    res.status(200).json({
      success: true,
      message: 'Rental cancelled successfully',
      data: rental,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;