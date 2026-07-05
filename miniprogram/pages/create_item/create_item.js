// pages/create_item/create_item.js - 支持新增和编辑模式，含快捷输入和语音输入
Page({
  data: {
    // 基础数据
    locationId: '',
    itemId: '',      // 编辑模式下的物品ID
    mode: 'add',     // 'add' 或 'edit'
    // 表单数据
    name: '',
    quantity: 1,
    unit: '个',
    unitSearchText: '',
    showUnitModal: false,
    filteredUnits: [],
    units: [
      '个', '瓶', '盒', '包', '袋', '罐', '支', '件', '箱',
      '克', '千克', '斤', '两', '公斤', '磅', '盎司',
      '毫升', '升', '立方厘米', '立方米',
      '厘米', '米', '毫米', '寸', '尺',
      '打', '套', '副', '双', '对', '组', '批',
      '张', '片', '块', '条', '根', '只', '头', '匹', '份', '台', '部', '本', '卷', '板'
    ],
    expiryDate: '',
    remark: '',
    startDate: new Date().toISOString().split('T')[0],
    // 状态
    isSaving: false,
    isLoading: false,
    // 快捷物品相关
    quickItems: [],
    quickSearchText: '',
    filteredQuickItems: []
  },

  onLoad: function (options) {
    this.initPresetItems();
    
    console.log('create_item页接收参数:', options);
    const { mode, itemId, locationId } = options;

    this.setData({
      mode: mode || 'add',
      itemId: itemId || '',
      locationId: locationId || ''
    });

    if (mode === 'edit') {
      wx.setNavigationBarTitle({ title: '编辑物品' });
      this.loadItemData(itemId);
    } else {
      wx.setNavigationBarTitle({ title: '添加物品' });
      if (!locationId) {
        wx.showToast({ title: '空间信息错误', icon: 'error' });
        wx.navigateBack();
      }
    }
    
    this.loadHistoryItems();
  },

  initPresetItems: function () {
    this.presetItems = [
      { name: '牛奶', unit: '盒', expiryDays: 7 },
      { name: '鸡蛋', unit: '个', expiryDays: 30 },
      { name: '面包', unit: '个', expiryDays: 3 },
      { name: '酸奶', unit: '瓶', expiryDays: 14 },
      { name: '可乐', unit: '瓶', expiryDays: 365 },
      { name: '薯片', unit: '袋', expiryDays: 180 },
      { name: '饼干', unit: '盒', expiryDays: 180 },
      { name: '方便面', unit: '包', expiryDays: 180 },
      { name: '火腿肠', unit: '根', expiryDays: 90 },
      { name: '罐头', unit: '罐', expiryDays: 365 },
      { name: '大米', unit: '袋', expiryDays: 365 },
      { name: '面粉', unit: '袋', expiryDays: 180 },
      { name: '食用油', unit: '桶', expiryDays: 365 },
      { name: '酱油', unit: '瓶', expiryDays: 365 },
      { name: '醋', unit: '瓶', expiryDays: 365 },
      { name: '料酒', unit: '瓶', expiryDays: 365 },
      { name: '盐', unit: '包', expiryDays: 365 },
      { name: '糖', unit: '袋', expiryDays: 365 },
      { name: '纸巾', unit: '包', expiryDays: 365 },
      { name: '洗衣液', unit: '瓶', expiryDays: 365 },
      { name: '洗洁精', unit: '瓶', expiryDays: 365 },
      { name: '洗发水', unit: '瓶', expiryDays: 365 },
      { name: '沐浴露', unit: '瓶', expiryDays: 365 },
      { name: '牙膏', unit: '支', expiryDays: 365 },
      { name: '牙刷', unit: '支', expiryDays: 180 },
      { name: '毛巾', unit: '条', expiryDays: 365 },
      { name: '口罩', unit: '个', expiryDays: 365 },
      { name: '电池', unit: '节', expiryDays: 365 },
      { name: '矿泉水', unit: '瓶', expiryDays: 365 },
      { name: '巧克力', unit: '块', expiryDays: 180 },
      { name: '糖果', unit: '袋', expiryDays: 365 },
      { name: '茶叶', unit: '盒', expiryDays: 365 },
      { name: '咖啡', unit: '袋', expiryDays: 365 },
      { name: '麦片', unit: '袋', expiryDays: 365 },
      { name: '坚果', unit: '袋', expiryDays: 180 },
      { name: '水果', unit: '斤', expiryDays: 7 },
      { name: '蔬菜', unit: '斤', expiryDays: 3 },
      { name: '肉', unit: '斤', expiryDays: 3 },
      { name: '鱼', unit: '条', expiryDays: 2 },
      { name: '虾', unit: '斤', expiryDays: 2 }
    ];
    this.setData({
      filteredUnits: this.data.units
    });
  },

  loadHistoryItems: function () {
    const db = wx.cloud.database();
    db.collection('item_templates').orderBy('lastUsedAt', 'desc').limit(20).get({
      success: (res) => {
        const historyItems = res.data.map(item => ({
          name: item.name,
          unit: item.unit || '个',
          expiryDays: item.expiryDays || 30,
          isHistory: true
        }));
        this.mergeItems(historyItems);
      },
      fail: (err) => {
        console.error('加载历史物品失败:', err);
        this.mergeItems([]);
      }
    });
  },

  mergeItems: function (historyItems) {
    const nameSet = new Set();
    const merged = [];
    
    historyItems.forEach(item => {
      if (!nameSet.has(item.name)) {
        nameSet.add(item.name);
        merged.push(item);
      }
    });
    
    this.presetItems.forEach(item => {
      if (!nameSet.has(item.name)) {
        merged.push(item);
      }
    });
    
    this.setData({
      quickItems: merged,
      filteredQuickItems: merged
    });
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
        const unit = item.unit || '个';
        // 如果保存的单位不在列表中，添加到列表
        const units = that.data.units;
        if (unit && !units.includes(unit)) {
          units.unshift(unit);
        }
        that.setData({
          name: item.name || '',
          quantity: item.quantity || 1,
          unit: unit,
          expiryDate: item.expiryDate || '',
          remark: item.remark || '',
          locationId: item.locationId || that.data.locationId,
          units: units,
          filteredUnits: units,
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
    const value = e.detail.value;
    // 允许空值，保存时再验证
    if (value === '') {
      this.setData({ quantity: '' });
      return;
    }
    let qty = parseInt(value);
    // 只处理有效数字，无效输入不做处理
    if (!isNaN(qty) && qty >= 1) {
      this.setData({ quantity: qty });
    }
  },

  // 显示单位选择弹窗
  showUnitPicker: function () {
    this.setData({
      showUnitModal: true,
      unitSearchText: '',
      filteredUnits: this.data.units
    });
  },

  // 隐藏单位选择弹窗
  hideUnitPicker: function () {
    this.setData({
      showUnitModal: false
    });
  },

  // 阻止事件冒泡
  preventHide: function () {
    // 什么都不做，只是阻止冒泡
  },

  // 搜索单位
  onUnitSearch: function (e) {
    const text = e.detail.value.trim();
    const allUnits = this.data.units;
    const filtered = text 
      ? allUnits.filter(u => u.includes(text))
      : allUnits;
    
    this.setData({
      unitSearchText: text,
      filteredUnits: filtered
    });
  },

  // 选择单位
  selectUnit: function (e) {
    const unit = e.currentTarget.dataset.unit;
    this.setData({
      unit: unit,
      showUnitModal: false
    });
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
    if (!quantity || quantity < 1) {
      wx.showToast({ title: '请填写有效数量', icon: 'none' });
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
    const { name, quantity, unit, expiryDate, remark, locationId } = this.data;

    var now = new Date().toISOString();
    var nowStr = now.substring(0, 10);
    db.collection('items').add({
      data: {
        name: name,
        quantity: quantity,
        unit: unit,
        expiryDate: expiryDate || null,
        remark: remark || '',
        locationId: locationId,
        createTime: now,
        createTimeStr: nowStr,
        status: '正常'
      },
      success: (res) => {
        console.log('新增物品成功，ID:', res._id);
        this.saveItemTemplate(name, unit, expiryDate);
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

  saveItemTemplate: function (name, unit, expiryDate) {
    const db = wx.cloud.database();
    const now = new Date();
    const expiryDays = this.calculateExpiryDays(expiryDate);
    
    db.collection('item_templates').where({
      name: name
    }).get({
      success: (res) => {
        if (res.data.length > 0) {
          db.collection('item_templates').doc(res.data[0]._id).update({
            data: {
              unit: unit,
              expiryDays: expiryDays,
              count: db.command.inc(1),
              lastUsedAt: now
            }
          });
        } else {
          db.collection('item_templates').add({
            data: {
              name: name,
              unit: unit,
              expiryDays: expiryDays,
              count: 1,
              lastUsedAt: now,
              createdAt: now
            }
          });
        }
      },
      fail: (err) => {
        console.error('保存模板失败:', err);
      }
    });
  },

  calculateExpiryDays: function (expiryDate) {
    if (!expiryDate) return 30;
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 30;
  },

  /**
   * 编辑模式：更新已有物品
   */
  updateItemInCloud: function (itemId) {
    this.setData({ isSaving: true });
    const db = wx.cloud.database();
    const { name, quantity, unit, expiryDate, remark } = this.data;

    db.collection('items').doc(itemId).update({
      data: {
        name: name,
        quantity: quantity,
        unit: unit,
        expiryDate: expiryDate || null,
        remark: remark || '',
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
  },

  // ===== 快捷物品选择功能 =====

  onQuickSearch: function (e) {
    const text = e.detail.value.trim();
    const allItems = this.data.quickItems;
    const filtered = text
      ? allItems.filter(item => item.name.includes(text))
      : allItems;
    this.setData({
      quickSearchText: text,
      filteredQuickItems: filtered
    });
  },

  selectQuickItem: function (e) {
    const item = e.currentTarget.dataset.item;
    const expiryDate = this.calculateExpiryDate(item.expiryDays);
    this.setData({
      name: item.name,
      unit: item.unit,
      expiryDate: expiryDate
    });
    wx.showToast({ title: '已选择：' + item.name, icon: 'none', duration: 1000 });
  },

  calculateExpiryDate: function (days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
});