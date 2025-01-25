const express = require('express');
const cors = require('cors');
const mysql = require('mysql2'); // 確保使用 mysql2
const bcrypt = require('bcryptjs');
const app = express();
const port = 3000;
const fs = require('fs');
const path = require('path');
const multer = require('multer');

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 設定資料庫連接
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'xxx',
  password: 'xxx',
  database: 'feedback_system'
});

connection.connect(err => {
  if (err) throw err;
  console.log('Connected!');
});


// 設定multer存儲配置
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')  // 指定文件儲存路徑
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)) // 使用日期防止重名
  }
});

const upload = multer({ storage: storage });

// 註冊新用戶
app.post('/register', async (req, res) => {
  const { account, password } = req.body;
  if (!account || !password) {
    return res.status(400).send('帳號和密碼不可為空');
  }

  try {
    // 檢查帳號是否已存在
    const checkQuery = 'SELECT * FROM users WHERE account = ?';
    connection.query(checkQuery, [account], (err, results) => {
      if (err) {
        console.error('資料庫查詢失敗:', err);
        return res.status(500).send('伺服器錯誤');
      }

      if (results.length > 0) {
        // 帳號已存在，拒絕註冊
        return res.status(409).send('帳號已存在，請選擇其他帳號');
      }

      // 如果帳號不存在，進行密碼加密及註冊
      bcrypt.genSalt(10, (err, salt) => {
        if (err) {
          console.error('生成 Salt 失敗:', err);
          return res.status(500).send('伺服器錯誤');
        }

        bcrypt.hash(password, salt, (err, hashedPassword) => {
          if (err) {
            console.error('加密密碼失敗:', err);
            return res.status(500).send('伺服器錯誤');
          }

          const insertQuery = 'INSERT INTO users (account, password) VALUES (?, ?)';
          connection.query(insertQuery, [account, hashedPassword], (err, result) => {
            if (err) {
              console.error('註冊失敗:', err);
              return res.status(500).send('註冊失敗');
            }
            res.send('註冊成功');
          });
        });
      });
    });
  } catch (err) {
    console.error('伺服器錯誤:', err);
    res.status(500).send('伺服器錯誤');
  }
});

// 用戶登入
app.post('/login', (req, res) => {
  const { account, password } = req.body;
  const sql = 'SELECT password FROM users WHERE account = ?';

  connection.query(sql, [account], async (err, results) => {
    if (err) {
      console.error('登入失敗:', err);
      return res.status(500).send('登入失敗');
    }

    if (results.length === 0) {
      return res.status(404).send('帳號不存在');
    }

    const match = await bcrypt.compare(password, results[0].password);
    if (match) {
      res.send('登入成功');
    } else {
      res.status(401).send('密碼錯誤');
    }
  });
});

app.post('/report', upload.single('image'), (req, res) => {
  const { address, event, description, dateTime } = req.body;
  const imagePath = req.file ? req.file.path : ""; // 如果沒有上傳圖片，設置為空字符串或適當的默認值

  // 插入數據到數據庫
  const insertQuery = 'INSERT INTO reports (address, event, description, dateTime, imagePath) VALUES (?, ?, ?, ?, ?)';
  connection.query(insertQuery, [address, event, description, dateTime, imagePath], (err, result) => {
    if (err) {
      console.error('數據插入失敗:', err);
      return res.status(500).send('數據儲存失敗');
    }
    res.send('事件報告已成功記錄');
  });
});

// 查詢已記錄的事件
app.get('/events', (req, res) => {
  const { address } = req.query;  // 從查詢參數中獲取地址
  let query = 'SELECT * FROM reports';
  
  if (address) {
    query += ` WHERE address LIKE '%${address}%'`;  // 使用 LIKE 運算符進行模糊匹配
  }

  connection.query(query, (err, results) => {
    if (err) {
      console.error('查詢失敗:', err);
      return res.status(500).send('無法執行查詢');
    }
    res.json(results);
  });
});



// 提供地圖數據
// 1. 提供台灣縣市邊界數據
app.get('/api/taiwan-county', (req, res) => {
  try {
      const mapData = fs.readFileSync(path.join(__dirname, '/Geojson/twCounty2010.geo.json'), 'utf8');
      res.json(JSON.parse(mapData));
  } catch (error) {
      console.error('讀取地圖數據失敗:', error);
      res.status(500).send('無法讀取地圖數據');
  }
});

// 2. 提供指定縣市的鄉鎮區數據
app.get('/api/taiwan-town/:countyName', (req, res) => {
  try {
      // 讀取存儲有所有鄉鎮區數據的文件
      const subRegionsData = fs.readFileSync(path.join(__dirname, '/Geojson/twTown1982.geo.json'), 'utf8');
      const subRegions = JSON.parse(subRegionsData);
      
      // 篩選出指定縣市的鄉鎮區
      const filteredSubRegions = subRegions.features.filter(feature => feature.properties.COUNTYNAME === req.params.countyName);

      // 返回篩選後的數據
      res.json({ features: filteredSubRegions });
  } catch (error) {
      console.error('讀取鄉鎮區數據失敗:', error);
      res.status(500).send('無法讀取鄉鎮區數據');
  }
});

// 3. 提供指定鄉鎮區的村里數據
app.get('/api/taiwan-village/:townName', (req, res) => {
  try {
      // 讀取存儲有所有村里數據的文件
      const villageData = fs.readFileSync(path.join(__dirname, '/Geojson/twVillage1982.geo.json'), 'utf8');
      const villages = JSON.parse(villageData);
      
      // 篩選出指定鄉鎮區的村里
      const filteredVillages = villages.features.filter(feature => feature.properties.TOWNNAME === req.params.townName);

      // 返回篩選後的數據
      res.json({ features: filteredVillages });
  } catch (error) {
      console.error('讀取村里數據失敗:', error);
      res.status(500).send('無法讀取村里數據');
  }
});

// 伺服器監聽
app.listen(port, () => {
  console.log(`伺服器正在運行在 http://localhost:${port}`);
});
