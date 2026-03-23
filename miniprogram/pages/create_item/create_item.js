// pages/create_item/create_item.js - 支持新增和编辑模式
Page({
  data: {
    // 基础数据
    locationId: '',
    itemId: '',      // 新增：编辑模式下的物品ID
    mode: 'add',     // 新增：'add' 或 'edit'
    // 表单数据
    name: '',
    quantity: 1,
    expiryDate: '',
    remark: '',
    startDate: new Date().toISOString().split('T')[0],
    // 状态
    isSaving: false,
    isLoading: false // 新增：编辑模式下加载数据的状态
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    console.log('create_item页接收参数:', options);
    const { mode, itemId, locationId } = options;

    // 1. 设置模式、ID等基础信息
    this.setData({
      mode: mode || 'add',
      itemId: itemId || '',
      locationId: locationId || ''
    });

    // 2. 根据模式设置页面标题和初始化数据
    if (mode === 'edit') {
      wx.setNavigationBarTitle({ title: '编辑物品' });
      this.loadItemData(itemId); // 编辑模式下，加载现有数据
    } else {
      wx.setNavigationBarTitle({ title: '添加物品' });
      // 新增模式下，确保locationId存在
      if (!locationId) {
        wx.showToast({ title: '空间信息错误', icon: 'error' });
        wx.navigateBack();
      }
    }
  },

  /**
   * 编辑模式下，加载物品现有数据
   */
  loadItemData: function (itemId) {
    const that = this;
    this.setData({ isLoading: true });
    const db = wx.cloud.database();
    
    db.collection('items').doc(itemId).get({
      success: function (res) {
        console.log('物品数据加载成功:', res.data);
        const item = res.data;
        that.setData({
          name: item.name || '',
          quantity: item.quantity || 1,
          expiryDate: item.expiryDate || '',
          remark: item.remark || '',
          locationId: item.locationId || that.data.locationId, // 确保locationId正确
          isLoading: false
        });
      },
      fail: function (err) {
        console.error('加载物品数据失败:', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
        that.setData({ isLoading: false });
        setTimeout(() => wx.navigateBack(), 1500);
      }
    });
  },

  // 监听物品名称输入
  onNameInput: function (e) {
    this.setData({ name: e.detail.value });
  },

  // 监听数量输入
  onQuantityInput: function (e) {
    let qty = parseInt(e.detail.value) || 1;
    if (qty < 1) qty = 1;
    this.setData({ quantity: qty });
  },

  // 减少数量
  decreaseQuantity: function () {
    let qty = this.data.quantity;
    if (qty > 1) {
      this.setData({ quantity: qty - 1 });
    }
  },

  // 增加数量
  increaseQuantity: function () {
    this.setData({ quantity: this.data.quantity + 1 });
  },

  // 监听备注输入
  onRemarkInput: function (e) {
    this.setData({ remark: e.detail.value });
  },

  // 监听保质期选择
  onExpiryDateChange: function (e) {
    this.setData({ expiryDate: e.detail.value });
  },

  /**
   * 点击保存按钮
   */
  onSubmit: function () {
    const { name, quantity, locationId, mode, itemId } = this.data;

    // 1. 验证
    if (!name.trim()) {
      wx.showToast({ title: '请填写物品名称', icon: 'none' });
      return;
    }
    if (!locationId) {
      wx.showToast({ title: '空间信息错误', icon: 'none' });
      return;
    }

    // 2. 防止重复提交
    if (this.data.isSaving) return;

    // 3. 根据模式调用不同的保存函数
    if (mode === 'edit') {
      this.updateItemInCloud(itemId);
    } else {
      this.saveNewItemToCloud();
    }
  },

  /**
   * 新增模式：保存新物品
   */
  saveNewItemToCloud: function () {
    this.setData({ isSaving: true });
    const db = wx.cloud.database();
    const { name, quantity, expiryDate, remark, locationId } = this.data;

    var now = new Date().toISOString();
    var nowStr = now.substring(0, 10);
    db.collection('items').add({
      data: {
        name: name,
        quantity: quantity,
        expiryDate: expiryDate || null,
        remark: remark || '',
        locationId: locationId,
        createTime: now,
        createTimeStr: nowStr,
        status: '正常'
      },
      success: (res) => {
        console.log('新增物品成功，ID:', res._id);
        wx.showToast({ title: '添加成功', icon: 'success', duration: 1500 });
        setTimeout(() => wx.navigateBack(), 1600);
      },
      fail: (err) => {
        console.error('新增物品失败:', err);
        wx.showToast({ title: '保存失败，请重试', icon: 'none' });
        this.setData({ isSaving: false });
      }
    });
  },

  /**
   * 编辑模式：更新已有物品
   */
  updateItemInCloud: function (itemId) {
    this.setData({ isSaving: true });
    const db = wx.cloud.database();
    const { name, quantity, expiryDate, remark } = this.data;

    db.collection('items').doc(itemId).update({
      data: {
        name: name,
        quantity: quantity,
        expiryDate: expiryDate || null,
        remark: remark || '',
        // 注意：编辑时不修改 locationId 和 createTime
      },
      success: (res) => {
        console.log('更新物品成功:', res);
        wx.showToast({ title: '更新成功', icon: 'success', duration: 1500 });
        setTimeout(() => wx.navigateBack(), 1600);
      },
      fail: (err) => {
        console.error('更新物品失败:', err);
        wx.showToast({ title: '更新失败，请重试', icon: 'none' });
        this.setData({ isSaving: false });
      }
    });
  }
});