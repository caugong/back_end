const express = require('express'); // const는 변수 선언입니다.
const https = require('https');
const http = require('http');
const fs = require('fs');
var mysql=require('mysql')
var qs=require('querystring')
var multer=require('multer')
var compression=require('compression');
var nodemailer=require('nodemailer');
var proj4=require('proj4')
var cors=require('cors')
var easyimg = require('easyimage');
var path = require('path')
var im = require('imagemagick');
var crypto = require('crypto');
var rs = require('request');
var moment = require('moment');
require('moment-timezone');
moment.tz.setDefault("Asia/Seoul");


const app = express();
const router=express.Router();

app.use(cors())
security_key={
  NCP_serviceId:'_______________________',
  NCP_accessKey:'_______________________',
  NCP_secretKey:'_______________________'
}

const NCP_url1='https://sens.apigw.ntruss.com/sms/v2/services/'+security_key.NCP_serviceId+'/messages'
const NCP_url2='/sms/v2/services/'+security_key.NCP_serviceId+'/messages'

const NCP_method = "POST";
const NCP_space = " ";
const NCP_newLine="\n";

const options = { // letsencrypt로 받은 인증서 경로를 입력해 줍니다.

ca: fs.readFileSync('/etc/letsencrypt/live/withpresso.gq/fullchain.pem'),
key: fs.readFileSync('/etc/letsencrypt/live/withpresso.gq/privkey.pem'),
cert: fs.readFileSync('/etc/letsencrypt/live/withpresso.gq/cert.pem')
};


http.createServer(app).listen(80);
https.createServer(options, app).listen(443);


app.use(function(req,res,next){
  if(!req.secure){
    res.redirect("https://withpresso.gq"+req.url);
  }
  else{
    next();
  }
})



proj4.defs([
  [
    'EPSG:4326',
    '+title=WGS 84 (long/lat) +proj=longlat +ellps=WGS84 +datum=WGS84 +units=degrees'
  ],
  [
    'EPSG:3857',
    '+title=WGS 84 / Pseudo-Mercator +proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs'
  ],
  [
    'EPSG:5179',
    '+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'
  ]
]);

//var firstProjection = "+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs"; //from
//var secondProjection = "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs"; //to
    //I'm not going to redefine those two in latter examples.

var transform_5179_to_4326 = proj4('EPSG:5179','EPSG:4326');

//파일 저장소
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null,'./profiles') // cb 콜백함수를 통해 전송된 파일 저장 디렉토리 설정
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname) // cb 콜백함수를 통해 전송된 파일 이름 설정
    }
  })

const upload = multer({storage: storage})

var connection=mysql.createConnection({
  host:'localhost',
  user:'caugong_developer',
  password:'12345678',
  database:'caugong_test2',
  dateStrings: 'date'
})
//data를 send 할떄, json 형식으로 success or fail + reason(why)
connection.connect()
app.use(express.json())

app.use("/profiles", express.static(__dirname + "/profiles"));
app.use("/cafe_pics", express.static(__dirname + "/cafe_pics"));

//app.use("/public2", express.static(__dirname + "/public2"));
//app.use(express.static('profiles'))
//app.use(express.static('cafe_pics'))

//만들어야
app.get('/profile_download', function(req, res){
  var user_number=req.query.uniq_num
  var images_name=req.query.image_name

  res.send('<img src="/'+user_number+'/'+images_name+'">')
})


app.get('/', (req, res) => {
  //res.send('Welcome to the WithPresso.')
  connection.query('select * from user_db',function(err,rows){
    if(err) throw err

    res.json(rows)
  })
  console.log("who enter this page")
})

app.get('/cafe_info/', (req, res) => {
  //res.send('Welcome to the WithPresso.')
  var input_cafe_asin=req.query.cafe_num

  if(input_cafe_asin===undefined){
    res.send('0')
  }
  else{connection.query('select * from cafe_data where cafe_asin =  \''+input_cafe_asin+'\'',function(err,rows){
    if(err) throw err

    var target_path = __dirname+'/cafe_pics/'+req.query.cafe_num.toString();

    if (fs.existsSync(target_path)){
      fs.readdir('./cafe_pics/'+req.query.cafe_num, function(error, filelist){
      rows[0].num_of_pics =filelist.length
      res.json(rows[0])
      })
    }
    else{
      rows[0].num_of_pics =0
      res.json(rows[0])
    }


  })}
  //console.log("who enter this page")
})

app.get('/cafe_recommend/', (req, res) => {
  //res.send('Welcome to the WithPresso.')
  //먼저 들어오늘 long과 lat을 4326으로 변환시켜줘야함
  //변환 시킨 것에 대해서 database에서 n개를 가져옴 -> 이거를 sorting (세개 더한것)
  //가져온것에 10개씩 페이지넘버에 따라 송출
  console.log("ENTER CAFE RECOMMEND")
  var input_uniq_num=req.query.uniq_num
  if (input_uniq_num===undefined) {
    res.send('0')
  }
  else{
    console.log(req.query.long)
    console.log(req.query.lat)
    connection.query('select cafe_name, cafe_asin, table_info, table_size_info, user_clean_info, user_toilet_clean_info, user_noisy_info, user_good_study_info, smoking_room, num_plug,  ST_DISTANCE_SPHERE(POINT('+req.query.long+','+req.query.lat+'),location) AS dist from cafe_data ORDER BY dist asc limit 100;',function(err,result){
      var prefer_1=0;
      var prefer_2=0;
      var prefer_3=0;

      for(var i=0;i<result.length;i++){
        result[i].rank=0
      }

      if(err) throw err;

      else{
        connection.query('select prefer_1, prefer_2, prefer_3 from user_db where user_asin=\''+input_uniq_num+'\'',function(err,rows){
          if(err) throw err;
          //결과값이 null일때(선호도 조사를 안했을때) -> null이 맞는지 봐야함
          //선호도 조사 X
          if(input_uniq_num==='0'){
            res.json(result.slice(0+(10*(parseInt(req.query.page_num)-1)),9+(10*(parseInt(req.query.page_num)-1))))

          }//로그인 X
          else if(!rows[0].prefer_1){
            res.json(result.slice(0+(10*(parseInt(req.query.page_num)-1)),9+(10*(parseInt(req.query.page_num)-1))))
          }
          else{
            prefer_1=rows[0].prefer_1
            prefer_2=rows[0].prefer_2
            prefer_3=rows[0].prefer_3

            //res.json(result)
            function sort_by_table_size_info(){

              function custonSort(a, b) {
              if(a.table_size_info == b.table_size_info){ return 0} return  a.table_size_info < b.table_size_info ? 1 : -1;
            }
            console.log(result.length)
            result.sort(custonSort);
            var original=result[0].table_size_info
            var rank_1=0

            for(var i=0;i<result.length;i++){

              if(result[i].table_size_info<original){
                rank_1=rank_1+25
                original=result[i].table_size_info
                result[i].rank=rank_1+result[i].rank
              }
              else{
                result[i].rank=rank_1+result[i].rank
              }
            }
          }
            function sort_by_user_noisy_info(){
              function custonSort(a, b) {
                if(a.user_noisy_info == b.user_noisy_info){ return 0} return  a.user_noisy_info < b.user_noisy_info ? 1 : -1;
              }
              result.sort(custonSort);
              var original=result[0].user_noisy_info
              var rank_2=0

              for(var i=0;i<result.length;i++){

                if(result[i].user_noisy_info<original){
                  rank_2=rank_2+1
                  original=result[i].user_noisy_info
                  result[i].rank=rank_2+result[i].rank
                }
                else{
                  result[i].rank=rank_2+result[i].rank
                }
              }
            }
            function sort_by_num_of_plugs(){
              function custonSort(a, b) {
                if(a.num_plug == b.num_plug){ return 0} return  a.num_plug < b.num_plug ? 1 : -1;
              }
              result.sort(custonSort);
              var original=result[0].num_plug
              var rank_3=0
              for(var i=0;i<result.length;i++){

                if(result[i].num_plug<original){
                  rank_3=rank_3+1
                  original=result[i].num_plug
                  result[i].rank=rank_3+result[i].rank
                }
                else{
                  result[i].rank=rank_3+result[i].rank
                }
              }
            }
            function sort_by_clean(){
              function custonSort(a, b) {
                if(a.user_clean_info+a.user_toilet_clean_info == b.user_clean_info+b.user_toilet_clean_info){ return 0} return  a.user_clean_info+a.user_toilet_clean_info < b.user_clean_info+b.user_toilet_clean_info ? 1 : -1;
              }
              result.sort(custonSort);
              var original=result[0].user_clean_info+result[0].user_toilet_clean_info
              var rank_4=0

              for(var i=0;i<result.length;i++){

                if(result[i].user_clean_info+result[i].user_toilet_clean_info<original){
                  rank_4=rank_4+1
                  original=result[i].user_clean_info+result[i].user_toilet_clean_info
                  result[i].rank=rank_4+result[i].rank
                }
                else{
                  result[i].rank=rank_4+result[i].rank
                }
              }
            }
            function sort_by_smoke(){
              function custonSort(a, b) {
                if(a.smoking_room == b.smoking_room){ return 0} return  a.smoking_room < b.smoking_room ? 1 : -1;
              }
              result.sort(custonSort);
              var original=result[0].smoking_room
              var rank_5=0
              for(var i=0;i<result.length;i++){

                if(result[i].smoking_room<original){
                  rank_5=rank_5+1000
                  original=result[i].smoking_room
                  result[i].rank=rank_5+result[i].rank
                }
                else{
                  result[i].rank=rank_5+result[i].rank
                }
              }
            }
            function sort_by_rank(){
              function custonSort(a, b) {
              if(a.rank == b.rank){ return 0} return  a.rank > b.rank ? 1 : -1;
            }
            result.sort(custonSort);
            }


            if(prefer_1==1 && prefer_2==2 && prefer_3==3){
              console.log('통과')
              sort_by_table_size_info()
              sort_by_user_noisy_info()
              sort_by_smoke()
              sort_by_rank()
              res.json(result.slice(0+(10*(parseInt(req.query.page_num)-1)),9+(10*(parseInt(req.query.page_num)-1))))
            }
            else if(prefer_1==1 && prefer_2==2 && prefer_3==4){
              sort_by_table_size_info()
              sort_by_user_noisy_info()
              sort_by_num_of_plugs()
              sort_by_rank()
              res.json(result.slice(0+(10*(parseInt(req.query.page_num)-1)),9+(10*(parseInt(req.query.page_num)-1))))
            }
            else if(prefer_1==1 && prefer_2==2 && prefer_3==5){
              sort_by_table_size_info()
              sort_by_user_noisy_info()
              sort_by_clean()
              sort_by_rank()
              res.json(result.slice(0+(10*(parseInt(req.query.page_num)-1)),9+(10*(parseInt(req.query.page_num)-1))))
            }
            else if(prefer_1==1 && prefer_2==3 && prefer_3==4){
              sort_by_table_size_info()
              sort_by_smoke()
              sort_by_num_of_plugs()
              sort_by_rank()
              res.json(result.slice(0+(10*(parseInt(req.query.page_num)-1)),9+(10*(parseInt(req.query.page_num)-1))))
            }
            else if(prefer_1==1 && prefer_2==3 && prefer_3==5){
              sort_by_table_size_info()
              sort_by_smoke()
              sort_by_clean()
              sort_by_rank()
              res.json(result.slice(0+(10*(parseInt(req.query.page_num)-1)),9+(10*(parseInt(req.query.page_num)-1))))
            }
            else if(prefer_1==1 && prefer_2==4 && prefer_3==5){
              sort_by_table_size_info()
              sort_by_num_of_plugs()
              sort_by_clean()
              sort_by_rank()
              res.json(result.slice(0+(10*(parseInt(req.query.page_num)-1)),9+(10*(parseInt(req.query.page_num)-1))))
            }
            else if(prefer_1==2 && prefer_2==3 && prefer_3==4){
              sort_by_user_noisy_info()
              sort_by_smoke()
              sort_by_num_of_plugs()
              sort_by_rank()
              res.json(result.slice(0+(10*(parseInt(req.query.page_num)-1)),9+(10*(parseInt(req.query.page_num)-1))))
            }
            else if(prefer_1==2 && prefer_2==3 && prefer_3==5){
              sort_by_user_noisy_info()
              sort_by_smoke()
              sort_by_clean()
              sort_by_rank()
              res.json(result.slice(0+(10*(parseInt(req.query.page_num)-1)),9+(10*(parseInt(req.query.page_num)-1))))
            }
            else if(prefer_1==2 && prefer_2==4 && prefer_3==5){
              sort_by_user_noisy_info()
              sort_by_num_of_plugs()
              sort_by_clean()
              sort_by_rank()
              res.json(result.slice(0+(10*(parseInt(req.query.page_num)-1)),9+(10*(parseInt(req.query.page_num)-1))))
            }
            else if(prefer_1==3 && prefer_2==4 && prefer_3==5){
              sort_by_smoke()
              sort_by_num_of_plugs()
              sort_by_clean()
              sort_by_rank()
              res.json(result.slice(0+(10*(parseInt(req.query.page_num)-1)),9+(10*(parseInt(req.query.page_num)-1))))
            }
          }


        })



      }
    })


  }

})

//아이디 중복체크
app.post('/id_dup_check/', function (request, response) {
    if (request.method == 'POST') {
        var body = '';

        request.on('data', function (data) {
            body += data;
            if (body.length > 1e6)
                request.connection.destroy();
        });

        request.on('end', function () {
            var post = qs.parse(body);
            const inputed_email = JSON.parse(JSON.stringify(post));
            if(inputed_email.input_email===undefined){
              res.send('An unusual approach')
            }
            else{
              connection.query('select EXISTS (select * from caugong_test2.user_db where user_ID = \''+inputed_email.input_email+'\') as is_existed',function(err,rows){
                if(err){
                  throw err
                }
                else{
                  var data=JSON.stringify(rows)
                  var parsed_data=JSON.parse(data)
                  if(parsed_data[0].is_existed===1){
                    response.send('1')
                  }
                  else{
                    response.send('0')
                  }
                }

              })
            }
        });
    }
})
//로그인 기능
app.post('/login/',function (request, response) {
    if (request.method == 'POST') {
        var body = '';

        request.on('data', function (data) {
            body += data;

            if (body.length > 1e6)
                request.connection.destroy();
        });

        request.on('end', function () {
            var post = qs.parse(body);
            const inputed_post_data=JSON.parse(JSON.stringify(post));
            if(inputed_post_data.user_id===undefined || inputed_post_data.user_pw===undefined){
              res.send('An unusual approach')

            }
            else{
              connection.query('select EXISTS (select * from caugong_test2.user_db where user_ID = \''+inputed_post_data.user_id+'\' and user_pw = \''+inputed_post_data.user_pw+'\') as is_existed',function(err,rows){
                if(err){
                  throw err
                }
                else{
                  var data=JSON.stringify(rows)
                  var parsed_data=JSON.parse(data)
                  if(parsed_data[0].is_existed===1){
                    //로그인시 사용자 데이터 넘겨주기.
                    connection.query('select * from user_db where user_ID = \''+inputed_post_data.user_id+'\' and user_pw = \''+inputed_post_data.user_pw+'\'',function(err,row){
                      if(err) throw err

                      response.json(row[0])
                    })
                  }
                  else{
                    var result = {
                      user_asin : 0 ,
                      user_name : "",
                      //image_location:""

                    }
                    //var result_for_post=JSON.parse(JSON.stringify(result));
                    response.json(result)
                  }
                }
              })
            }
        });
    }
})

//일단 사진은 보류하고 회원가입.
app.post('/signup/',function (request, response) {
    if (request.method == 'POST') {
        var body = '';

        request.on('data', function (data) {
            body += data;

            // Too much POST data, kill the connection!
            // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
            if (body.length > 1e6)
                request.connection.destroy();
        });

        request.on('end', function () {
            var post = qs.parse(body);
            const inputed_post_data=JSON.parse(JSON.stringify(post));

            if(inputed_post_data.input_email===undefined || inputed_post_data.input_pw===undefined ||inputed_post_data.input_nick ===undefined || inputed_post_data.input_phone===undefined){
              res.send('An unusual approach')
            }
            else{
                console.log("A")
                connection.query('select EXISTS (select * from caugong_test2.user_db where user_ID = \''+inputed_post_data.input_email+'\') as is_existed',function(err,rows){
                if(err){
                  throw err
                }
                else{
                  var data=JSON.stringify(rows)
                  var parsed_data=JSON.parse(data)
                  if(parsed_data[0].is_existed===0){
                    //아이디 만들기 시작. -> 이름이 없다.
                    connection.query('INSERT INTO caugong_test2.user_db (user_name, user_ID, user_pw, user_tel) VALUES (\''+inputed_post_data.input_nick+'\',\''+inputed_post_data.input_email+'\',\''+inputed_post_data.input_pw+'\',\''+inputed_post_data.input_phone+'\')')
                    //response.send('1')
                    connection.query('COMMIT')
                    connection.query('select * from user_db where user_ID = \''+inputed_post_data.input_email+'\' and user_pw = \''+inputed_post_data.input_pw+'\'',function(err,row){
                      if(err) throw err

                      var data=JSON.stringify(row)
                      var parsed_data=JSON.parse(data)

                      //console.log(parsed_data)
                      //console.log(parsed_data[0].is_existed)
                      console.log(parsed_data[0].user_asin)
                      response.send(parsed_data[0].user_asin.toString())
                    })
                  }
                  else{
                    //아이디가 금새 만들어진 경우
                    response.send('0')
                  }

                }
              })
            }
        });
    }
})

app.post('/profile/',upload.single("new_profile"),function(req,res){


  var tmp_path = req.file.path;
  var original_path = __dirname+'/profiles/'+req.file.originalname;

  var target_path = __dirname+'/profiles/'+req.body.user_asin.toString();

  if (!fs.existsSync(target_path)){
    fs.mkdirSync(target_path);
  }
  fs.renameSync(original_path,target_path+'/'+req.file.original_name)

  im.identify(target_path+'/'+req.file.original_name,function(err,features){
    if(err) throw err;

    width=features.width
    height=features.height

    im.resize({
      format: 'jpg',
      srcPath: target_path+'/'+req.file.original_name,
      dstPath: target_path+'/1.jpg',
      width: width,
      height: height
    }, function(err, stdout, stderr){
      fs.unlinkSync(target_path+'/'+req.file.original_name)
      res.send('1')
    })
  })

})

app.post('/survey/', function (request, response) {
    if (request.method == 'POST') {
        var body = '';

        request.on('data', function (data) {
            body += data;

            // Too much POST data, kill the connection!
            // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
            if (body.length > 1e6)
                request.connection.destroy();
        });

        request.on('end', function () {
          var post = qs.parse(body);
          const inputed_survey=JSON.parse(JSON.stringify(post));

          connection.query('UPDATE user_db SET prefer_1 =\''+inputed_survey.survey1+'\', prefer_2 =\''+inputed_survey.survey2+'\' , prefer_3 =\''+inputed_survey.survey3+'\'WHERE user_ID =\''+inputed_survey.input_email+'\'' ,function(err,rows){
            if(err) {
              response.send('0')
              throw err
            }

            connection.query('COMMIT')
            response.send('1')

          })
            // use post['blah'], etc.
        });
    }
})
//complete
app.post('/owner/id_dup_check_service',function (request, response) {
    if (request.method == 'POST') {
        var body = '';

        request.on('data', function (data) {
            body += data;
            if (body.length > 1e6)
                request.connection.destroy();
        });

        request.on('end', function () {
            var post = qs.parse(body);
            const inputed_owner_id = JSON.parse(JSON.stringify(post));
            if(inputed_owner_id.owner_id===undefined){
              response.send('An unusual approach')
            }
            else{
              connection.query('select EXISTS (select * from caugong_test2.owner_db where owner_ID = \''+inputed_owner_id.owner_id+'\') as is_existed',function(err,rows){
                if(err){
                  throw err
                }
                else{
                  var data=JSON.stringify(rows)
                  var parsed_data=JSON.parse(data)
                  console.log(parsed_data)
                  console.log(parsed_data[0].is_existed)
                  if(parsed_data[0].is_existed===1){
                    response.send('1')
                  }
                  else{
                    response.send('0')
                  }
                }

              })
            }
        });
    }
})
//complete
app.post('/owner/sign_up_service',function (request, response) {
    if (request.method == 'POST') {
        var body = '';

        request.on('data', function (data) {
            body += data;

            // Too much POST data, kill the connection!
            // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
            if (body.length > 1e6)
                request.connection.destroy();
        });

        request.on('end', function () {
            var post = qs.parse(body);
            const inputed_post_data=JSON.parse(JSON.stringify(post));

            if(inputed_post_data.owner_id===undefined || inputed_post_data.owner_pw===undefined ||inputed_post_data.busi_num ===undefined || inputed_post_data.owner_name===undefined){
              response.send('An unusual approach')
            }
            else{
                console.log("A")
                connection.query('select EXISTS (select * from caugong_test2.owner_db where owner_ID = \''+inputed_post_data.owner_id+'\') as is_existed',function(err,rows){
                if(err){
                  throw err
                }
                else{
                  var data=JSON.stringify(rows)
                  var parsed_data=JSON.parse(data)
                  if(parsed_data[0].is_existed===0){
                    //아이디 만들기 시작. -> 이름이 없다.
                    connection.query('INSERT INTO caugong_test2.owner_db (owner_name, owner_ID, owner_pw, busi_num) VALUES (\''+inputed_post_data.owner_name+'\',\''+inputed_post_data.owner_id+'\',\''+inputed_post_data.owner_pw+'\',\''+inputed_post_data.busi_num+'\')')
                    //response.send('1')
                    connection.query('COMMIT')
                    //카페 정보 넣기
                    //connection.query('INSERT INTO caugong_')
                    connection.query('select * from owner_db where owner_ID = \''+inputed_post_data.owner_id+'\' and owner_pw = \''+inputed_post_data.owner_pw+'\'',function(err,row){
                      if(err) throw err

                      response.json(row[0])
                    })
                  }
                  else{
                    //아이디가 금새 만들어진 경우
                    response.send('0')
                  }

                }
              })
            }
        });
    }
})

app.post('/owner/update_cafe_info',function(request,response){
  console.log("HELLO")
  if (request.method == 'POST') {
      var body = '';

      request.on('data', function (data) {
          body += data;

          // Too much POST data, kill the connection!
          // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
          if (body.length > 1e6)
              request.connection.destroy();
      });

      request.on('end', function () {
        var post_cafe_data = qs.parse(body);

        if(post_cafe_data.cafe_asin===undefined||post_cafe_data.cafe_name===undefined || post_cafe_data.cafe_hour===undefined || post_cafe_data.cafe_addr===undefined ||post_cafe_data.cafe_tel ===undefined || post_cafe_data.cafe_menu===undefined ||post_cafe_data.table_info===undefined ||post_cafe_data.table_size_info===undefined ||post_cafe_data.chair_back_info===undefined ||post_cafe_data.chair_cushion_info===undefined ||post_cafe_data.num_plug===undefined ||post_cafe_data.bgm_info===undefined ||post_cafe_data.toilet_info===undefined ||post_cafe_data.toilet_gender_info===undefined ||post_cafe_data.sterilization_info===undefined ||post_cafe_data.smoking_room===undefined||post_cafe_data.discount===undefined){
          response.send('0')
        }
        else{
          if(parseInt(post_cafe_data.change)===1){
            if(post_cafe_data.complexity_level===undefined ||post_cafe_data.num_of_customer===undefined){
              response.send('0')
            }
            else{
              connection.query('UPDATE cafe_data SET cafe_name = \''+post_cafe_data.cafe_name+'\',cafe_hour=\''+post_cafe_data.cafe_hour+'\',cafe_addr=\''+ post_cafe_data.cafe_addr+'\',cafe_tel=\''+post_cafe_data.cafe_tel+'\',cafe_menu=\''+post_cafe_data.cafe_menu+'\',table_info=\''+post_cafe_data.table_info+'\',table_size_info=\''+post_cafe_data.table_size_info+'\',chair_back_info=\''+post_cafe_data.chair_back_info+'\',chair_cushion_info=\''+post_cafe_data.chair_cushion_info+'\',num_plug=\''+post_cafe_data.num_plug+'\',bgm_info=\''+post_cafe_data.bgm_info+'\',toilet_info=\''+post_cafe_data.toilet_info+'\',toilet_gender_info=\''+post_cafe_data.toilet_gender_info+'\',sterilization_info=\''+post_cafe_data.sterilization_info+'\',smoking_room=\''+post_cafe_data.smoking_room+'\',discount=\''+post_cafe_data.discount+'\',complexity_level=\''+post_cafe_data.complexity_level+'\',num_of_customer=\''+post_cafe_data.num_of_customer+'\' where cafe_asin=\''+post_cafe_data.cafe_asin+'\'',function(err,rows){
                if(err) throw err

                response.send('1')
              })
            }
          }
          else{
            connection.query('UPDATE cafe_data SET cafe_name = \''+post_cafe_data.cafe_name+'\',cafe_hour=\''+post_cafe_data.cafe_hour+'\',cafe_addr=\''+ post_cafe_data.cafe_addr+'\',cafe_tel=\''+post_cafe_data.cafe_tel+'\',cafe_menu=\''+post_cafe_data.cafe_menu+'\',table_info=\''+post_cafe_data.table_info+'\',table_size_info=\''+post_cafe_data.table_size_info+'\',chair_back_info=\''+post_cafe_data.chair_back_info+'\',chair_cushion_info=\''+post_cafe_data.chair_cushion_info+'\',num_plug=\''+post_cafe_data.num_plug+'\',bgm_info=\''+post_cafe_data.bgm_info+'\',toilet_info=\''+post_cafe_data.toilet_info+'\',toilet_gender_info=\''+post_cafe_data.toilet_gender_info+'\',sterilization_info=\''+post_cafe_data.sterilization_info+'\',smoking_room=\''+post_cafe_data.smoking_room+'\',discount=\''+post_cafe_data.discount+'\' where cafe_asin=\''+post_cafe_data.cafe_asin+'\'',function(err,rows){
              if(err) throw err

              response.send('1')
            })
          }

        }

          // use post['blah'], etc.
      });
  }
})

app.post('/owner/login/',function (request, response) {
    if (request.method == 'POST') {
        var body = '';

        request.on('data', function (data) {
            body += data;

            if (body.length > 1e6)
                request.connection.destroy();
        });

        request.on('end', function () {
            var post = qs.parse(body);
            const inputed_post_data=JSON.parse(JSON.stringify(post));
            if(inputed_post_data.owner_id===undefined || inputed_post_data.owner_pw===undefined){
              res.send('An unusual approach')

            }
            else{
              connection.query('select EXISTS (select * from caugong_test2.owner_db where owner_ID = \''+inputed_post_data.owner_id+'\' and owner_pw = \''+inputed_post_data.owner_pw+'\') as is_existed',function(err,rows){
                if(err){
                  throw err
                }
                else{
                  var data=JSON.stringify(rows)
                  var parsed_data=JSON.parse(data)
                  if(parsed_data[0].is_existed===1){
                    //로그인시 사용자 데이터 넘겨주기.
                    connection.query('select * from owner_db where owner_ID = \''+inputed_post_data.owner_id+'\' and owner_pw = \''+inputed_post_data.owner_pw+'\'',function(err,row){
                      if(err) throw err

                      response.json(row[0])
                    })
                  }
                  else{
                    var result = {
                      cafe_asin : 0 ,
                      owner_asin: 0,
                      owner_name : ""
                    }
                    //var result_for_post=JSON.parse(JSON.stringify(result));
                    response.json(result)
                  }
                }
              })
            }
        });
    }
})

app.post('/owner/cafe_info_register',function (request, response) {
    if (request.method == 'POST') {
        var body = '';


        request.on('data', function (data) {
            body += data;

            // Too much POST data, kill the connection!
            // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
            if (body.length > 1e6)
                request.connection.destroy();
        });

        request.on('end', function () {
            var post_cafe_data = qs.parse(body);


            if(post_cafe_data.cafe_name===undefined || post_cafe_data.cafe_hour===undefined || post_cafe_data.cafe_addr===undefined ||post_cafe_data.cafe_tel ===undefined || post_cafe_data.cafe_menu===undefined ||post_cafe_data.table_info===undefined ||post_cafe_data.table_size_info===undefined ||post_cafe_data.chair_back_info===undefined ||post_cafe_data.chair_cushion_info===undefined ||post_cafe_data.num_plug===undefined ||post_cafe_data.bgm_info===undefined ||post_cafe_data.toilet_info===undefined ||post_cafe_data.toilet_gender_info===undefined ||post_cafe_data.sterilization_info===undefined ||post_cafe_data.smoking_room===undefined||post_cafe_data.discount===undefined||post_cafe_data.coor_x===undefined||post_cafe_data.coor_y===undefined){
              response.send('An unusual approach')
            }
            else{
              var calculated_location = transform_5179_to_4326.forward([parseFloat(post_cafe_data.coor_x),parseFloat(post_cafe_data.coor_y)]);
              connection.query('INSERT INTO cafe_data (cafe_name,cafe_hour,cafe_addr,location,cafe_tel,cafe_menu,table_info,table_size_info,chair_back_info,chair_cushion_info,num_plug,bgm_info,toilet_info,toilet_gender_info,sterilization_info,smoking_room,discount) VALUES(\''+post_cafe_data.cafe_name+'\', \''+post_cafe_data.cafe_hour+'\',\''+ post_cafe_data.cafe_addr+'\',POINT('+calculated_location[0]+','+calculated_location[1]+'),\''+post_cafe_data.cafe_tel+'\', \''+post_cafe_data.cafe_menu+'\',\''+post_cafe_data.table_info+'\',\''+post_cafe_data.table_size_info+'\',\''+post_cafe_data.chair_back_info+'\',\''+post_cafe_data.chair_cushion_info+'\',\''+post_cafe_data.num_plug+'\',\''+post_cafe_data.bgm_info+'\',\''+post_cafe_data.toilet_info+'\',\''+post_cafe_data.toilet_gender_info+'\',\''+post_cafe_data.sterilization_info+'\',\''+post_cafe_data.smoking_room+'\',\''+post_cafe_data.discount+'\')',function(err,rows){
                if(err) throw err

                connection.query('select * from cafe_data where cafe_name=\''+post_cafe_data.cafe_name+'\' AND cafe_addr=\''+post_cafe_data.cafe_addr+'\'',function(err2,rows2){
                  if(err2) throw err2
                  connection.query('update owner_db set cafe_asin=\''+rows2[0].cafe_asin+'\' where owner_asin=\''+post_cafe_data.owner_asin+'\'',function(err3,rows3){
                    if(err3) throw err3

                    response.json(rows2[0])
                  })

                })
              })
            }


        });
    }
})

app.get('/owner/owners_cafe_infomation/', (req, res) => {
  //res.send('Welcome to the WithPresso.')
  var input_cafe_asin=req.query.cafe_asin

  if(input_cafe_asin===undefined){
    res.send('0')
  }
  else{connection.query('select * from cafe_data where cafe_asin =  \''+input_cafe_asin+'\'',function(err,rows){
    if(err) throw err

    res.json(rows[0])
  })}
  //console.log("who enter this page")
})

app.post('/owner/cafe_photo/',upload.array("cafe_photo",5),function(req,res){

  var tmp_path = req.files.path;
  var num_of_pics = req.body.num_of_pics
  var i=0

  var target_path = __dirname+'/cafe_pics/'+req.body.cafe_asin.toString();

  if (!fs.existsSync(target_path)){
    fs.mkdirSync(target_path);
  }
  var original_path
  var original_name="0"
  var tmp_extless=''
  var final_path=''
  var width=0
  var height=0

  if(num_of_pics>0){
    original_path0 = __dirname+'/profiles/'+req.files[0].originalname;
    fs.renameSync(original_path0,target_path+'/'+req.files[0].originalname)

    im.identify(target_path+'/'+req.files[0].originalname,function(err,features){
      if(err) throw err

      width0=features.width
      height0=features.height

      im.resize({
        format: 'jpg',
        srcPath: target_path+'/'+req.files[0].originalname,
        dstPath: target_path+'/1.jpg',
        width: width0,
        height: height0
        }, function(err, stdout, stderr){
          fs.unlinkSync(target_path+'/'+req.files[0].originalname)
          if(num_of_pics==1){
            connection.query('UPDATE cafe_data SET num_of_pics =\''+num_of_pics+'\' WHERE cafe_asin =\''+req.body.cafe_asin.toString()+'\'' ,function(err,rows){
              if(err) {
                response.send('0')
                throw err
              }
              connection.query('COMMIT')
            })
            res.send(num_of_pics)
          }
          else{
            if(num_of_pics>1){
              original_path1 = __dirname+'/profiles/'+req.files[1].originalname;
              fs.renameSync(original_path1,target_path+'/'+req.files[1].originalname)

              im.identify(target_path+'/'+req.files[1].originalname,function(err,features){
                if(err) throw err
                console.log(i)
                width1=features.width
                height1=features.height
                console.log(width1)
                console.log(height1)
                im.resize({
                  format: 'jpg',
                  srcPath: target_path+'/'+req.files[1].originalname,
                  dstPath: target_path+'/2.jpg',
                  width: width1,
                  height: height1
                  }, function(err, stdout, stderr){
                    fs.unlinkSync(target_path+'/'+req.files[1].originalname)
                    if(num_of_pics==2){
                      connection.query('UPDATE cafe_data SET num_of_pics =\''+num_of_pics+'\' WHERE cafe_asin =\''+req.body.cafe_asin.toString()+'\'' ,function(err,rows){
                        if(err) {
                          response.send('0')
                          throw err
                        }
                        connection.query('COMMIT')
                      })
                      res.send(num_of_pics)
                    }
                    else{
                      if(num_of_pics>2){
                        original_path2 = __dirname+'/profiles/'+req.files[2].originalname;
                        fs.renameSync(original_path2,target_path+'/'+req.files[2].originalname)

                        im.identify(target_path+'/'+req.files[2].originalname,function(err,features){
                          if(err) throw err
                          console.log(i)
                          width2=features.width
                          height2=features.height
                          console.log(width2)
                          console.log(height2)
                          im.resize({
                            format: 'jpg',
                            srcPath: target_path+'/'+req.files[2].originalname,
                            dstPath: target_path+'/3.jpg',
                            width: width2,
                            height: height2
                            }, function(err, stdout, stderr){
                              fs.unlinkSync(target_path+'/'+req.files[2].originalname)
                              if(num_of_pics==3){
                                connection.query('UPDATE cafe_data SET num_of_pics =\''+num_of_pics+'\' WHERE cafe_asin =\''+req.body.cafe_asin.toString()+'\'' ,function(err,rows){
                                  if(err) {
                                    response.send('0')
                                    throw err
                                  }
                                  connection.query('COMMIT')
                                })
                                res.send(num_of_pics)
                              }
                              else{
                                if(num_of_pics>3){
                                  original_path3 = __dirname+'/profiles/'+req.files[3].originalname;
                                  fs.renameSync(original_path3,target_path+'/'+req.files[3].originalname)

                                  im.identify(target_path+'/'+req.files[3].originalname,function(err,features){
                                    if(err) throw err
                                    console.log(i)
                                    width3=features.width
                                    height3=features.height
                                    console.log(width3)
                                    console.log(height3)
                                    im.resize({
                                      format: 'jpg',
                                      srcPath: target_path+'/'+req.files[3].originalname,
                                      dstPath: target_path+'/4.jpg',
                                      width: width3,
                                      height: height3
                                      }, function(err, stdout, stderr){
                                        fs.unlinkSync(target_path+'/'+req.files[3].originalname)
                                        if(num_of_pics==4){
                                          connection.query('UPDATE cafe_data SET num_of_pics =\''+num_of_pics+'\' WHERE cafe_asin =\''+req.body.cafe_asin.toString()+'\'' ,function(err,rows){
                                            if(err) {
                                              response.send('0')
                                              throw err
                                            }
                                            connection.query('COMMIT')
                                          })
                                          res.send(num_of_pics)
                                        }
                                        else{
                                          if(num_of_pics>4){
                                            original_path4 = __dirname+'/profiles/'+req.files[4].originalname;
                                            fs.renameSync(original_path4,target_path+'/'+req.files[4].originalname)

                                            im.identify(target_path+'/'+req.files[4].originalname,function(err,features){
                                              if(err) throw err
                                              console.log(i)
                                              width4=features.width
                                              height4=features.height
                                              console.log(width4)
                                              console.log(height4)
                                              im.resize({
                                                format: 'jpg',
                                                srcPath: target_path+'/'+req.files[4].originalname,
                                                dstPath: target_path+'/5.jpg',
                                                width: width4,
                                                height: height4
                                                }, function(err, stdout, stderr){
                                                  fs.unlinkSync(target_path+'/'+req.files[4].originalname)
                                                  if(num_of_pics==5){
                                                    connection.query('UPDATE cafe_data SET num_of_pics =\''+num_of_pics+'\' WHERE cafe_asin =\''+req.body.cafe_asin.toString()+'\'' ,function(err,rows){
                                                      if(err) {
                                                        response.send('0')
                                                        throw err
                                                      }
                                                      connection.query('COMMIT')
                                                    })
                                                    res.send(num_of_pics)
                                                  }
                                               })
                                            })
                                          }
                                        }
                                     })
                                  })
                                }
                              }
                           })
                        })
                      }
                    }
                 })
              })
            }
          }
       })
    })
  }
  //위는 콜백 지옥이다.
  /*if(num_of_pics>0){
    original_path = __dirname+'/profiles/'+req.files[0].originalname;
    fs.renameSync(original_path,target_path+'/'+req.files[0].originalname)

    im.identify(target_path+'/'+req.files[0].originalname,function(err,features){
      if(err) throw err
      console.log(i)
      width=features.width
      height=features.height
      console.log(width)
      console.log(height)
      im.resize({
        format: 'jpg',
        srcPath: target_path+'/'+req.files[0].originalname,
        dstPath: target_path+'/1.jpg',
        width: width,
        height: height
        }, function(err, stdout, stderr){
          fs.unlinkSync(target_path+'/'+req.files[0].originalname)
          if(num_of_pics==1){
            connection.query('UPDATE cafe_data SET num_of_pics =\''+num_of_pics+'\' WHERE cafe_asin =\''+req.body.cafe_asin.toString()+'\'' ,function(err,rows){
              if(err) {
                response.send('0')
                throw err
              }
              connection.query('COMMIT')
            })
            res.send(num_of_pics)
          }
       })
    })
  }

  if(num_of_pics>1){
    original_path = __dirname+'/profiles/'+req.files[1].originalname;
    fs.renameSync(original_path,target_path+'/'+req.files[1].originalname)

    im.identify(target_path+'/'+req.files[1].originalname,function(err,features){
      if(err) throw err
      console.log(i)
      width=features.width
      height=features.height
      console.log(width)
      console.log(height)
      im.resize({
        format: 'jpg',
        srcPath: target_path+'/'+req.files[1].originalname,
        dstPath: target_path+'/2.jpg',
        width: width,
        height: height
        }, function(err, stdout, stderr){
          fs.unlinkSync(target_path+'/'+req.files[1].originalname)
          if(num_of_pics==2){
            connection.query('UPDATE cafe_data SET num_of_pics =\''+num_of_pics+'\' WHERE cafe_asin =\''+req.body.cafe_asin.toString()+'\'' ,function(err,rows){
              if(err) {
                response.send('0')
                throw err
              }
              connection.query('COMMIT')
            })
            res.send(num_of_pics)
          }
       })
    })
  }

  if(num_of_pics>2){
    original_path = __dirname+'/profiles/'+req.files[2].originalname;
    fs.renameSync(original_path,target_path+'/'+req.files[2].originalname)

    im.identify(target_path+'/'+req.files[2].originalname,function(err,features){
      if(err) throw err
      console.log(i)
      width=features.width
      height=features.height
      console.log(width)
      console.log(height)
      im.resize({
        format: 'jpg',
        srcPath: target_path+'/'+req.files[2].originalname,
        dstPath: target_path+'/3.jpg',
        width: width,
        height: height
        }, function(err, stdout, stderr){
          fs.unlinkSync(target_path+'/'+req.files[2].originalname)
          if(num_of_pics==3){
            connection.query('UPDATE cafe_data SET num_of_pics =\''+num_of_pics+'\' WHERE cafe_asin =\''+req.body.cafe_asin.toString()+'\'' ,function(err,rows){
              if(err) {
                response.send('0')
                throw err
              }
              connection.query('COMMIT')
            })
            res.send(num_of_pics)
          }
       })
    })
  }


  if(num_of_pics>3){
    original_path = __dirname+'/profiles/'+req.files[3].originalname;
    fs.renameSync(original_path,target_path+'/'+req.files[3].originalname)

    im.identify(target_path+'/'+req.files[3].originalname,function(err,features){
      if(err) throw err
      console.log(i)
      width=features.width
      height=features.height
      console.log(width)
      console.log(height)
      im.resize({
        format: 'jpg',
        srcPath: target_path+'/'+req.files[3].originalname,
        dstPath: target_path+'/4.jpg',
        width: width,
        height: height
        }, function(err, stdout, stderr){
          fs.unlinkSync(target_path+'/'+req.files[3].originalname)
          if(num_of_pics==4){
            connection.query('UPDATE cafe_data SET num_of_pics =\''+num_of_pics+'\' WHERE cafe_asin =\''+req.body.cafe_asin.toString()+'\'' ,function(err,rows){
              if(err) {
                response.send('0')
                throw err
              }
              connection.query('COMMIT')
            })
            res.send(num_of_pics)
          }
       })
    })
  }


  if(num_of_pics>4){
    original_path = __dirname+'/profiles/'+req.files[4].originalname;
    fs.renameSync(original_path,target_path+'/'+req.files[4].originalname)

    im.identify(target_path+'/'+req.files[4].originalname,function(err,features){
      if(err) throw err
      console.log(i)
      width=features.width
      height=features.height
      console.log(width)
      console.log(height)
      im.resize({
        format: 'jpg',
        srcPath: target_path+'/'+req.files[4].originalname,
        dstPath: target_path+'/5.jpg',
        width: width,
        height: height
        }, function(err, stdout, stderr){
          fs.unlinkSync(target_path+'/'+req.files[4].originalname)
          if(num_of_pics==5){
            connection.query('UPDATE cafe_data SET num_of_pics =\''+num_of_pics+'\' WHERE cafe_asin =\''+req.body.cafe_asin.toString()+'\'' ,function(err,rows){
              if(err) {
                response.send('0')
                throw err
              }
              connection.query('COMMIT')
            })
            res.send(num_of_pics)
          }
       })
    })
  }*/



})

app.post('/owner/phone_num/',function (req, res) {
    if (req.method == 'POST') {
        var body = '';

        req.on('data', function (data) {
            body += data;

            if (body.length > 1e6)
                req.connection.destroy();
        });

        req.on('end', function () {
            var post = qs.parse(body);
            const inputed_phone=JSON.parse(JSON.stringify(post));
            var user_phone_num=inputed_phone.phone_num
            var input_cafe_asin=inputed_phone.cafe_asin
            var auth_code= Math.floor(Math.random() * (999999 - 100000)) + 100000;
            var date2 = moment().add(10,'m').format('YYYY-MM-DD HH:mm:ss');
            console.log(date2);
            console.log(inputed_phone)
            if(user_phone_num===undefined || input_cafe_asin===undefined){
              console.log('여기다')
              res.send('0')

            }
            else{
              connection.query('INSERT INTO auth (cafe_asin, user_tel, auth_code, valid_time) VALUES (\''+input_cafe_asin+'\',\''+user_phone_num+'\',\''+auth_code+'\',\''+date2+'\')',function(err0,rows0){
                if(err0){
                  throw err0
                }
                else{
                  connection.query('select EXISTS (select * from caugong_test2.user_db where user_tel = \''+user_phone_num+'\') as is_existed',function(err1,rows1){
                    if(err1){
                      throw err1
                    }
                    else{
                      connection.query('select cafe_name from cafe_data where cafe_asin = \''+input_cafe_asin+'\'',function(err2,rows2){
                        if(err2){
                          throw err2
                        }
                        else{
                          cafe_name=rows2[0].cafe_name
                          var data=JSON.stringify(rows1)
                          var parsed_data=JSON.parse(data)

                          if(parsed_data[0].is_existed===1){
                            //유저가 정보가 있을때
                            const timestamp = Date.now().toString();
                            let message=[]
                            message.push(NCP_method);
                            message.push(NCP_space);
                            message.push(NCP_url2);
                            message.push(NCP_newLine);
                            message.push(timestamp);
                            message.push(NCP_newLine);
                            message.push(security_key.NCP_accessKey);
                            connection.query('select user_name from caugong_test2.user_db where user_tel = \''+user_phone_num+'\'',function(err3,rows3){
                            var user_name=rows3[0].user_name

                            let hmac=crypto.createHmac('sha256',security_key.NCP_secretKey);
                            const signature = hmac.update(message.join('')).digest('base64');
                            rs({
                                method: NCP_method,
                                json: true,
                                uri: NCP_url1,
                                headers: {
                                    'Content-Type': 'application/json; charset=utf-8',
                                    'x-ncp-iam-access-key' : security_key.NCP_accessKey,
                                    'x-ncp-apigw-timestamp': timestamp,
                                    'x-ncp-apigw-signature-v2': signature.toString()
                                },
                                body: {
                                    "type":"MMS",
                                    "contentType":"COMM",
                                    "countryCode":"82",
                                    "from": '01099237720',
                                    "content":'위드프레소\n안녕하세요.'+user_name+'님\n['+cafe_name+'] 인증 번호 ['+auth_code+']입니다',
                                    "messages":[
                                        {
                                            "to":`${user_phone_num}`,
                                        }
                                    ]
                                }
                            },function (err3, res3, html) {
                                if(err3) throw err3;
                                console.log(html);
                                res.send('1')
                            })
                            })

                          }
                          else{
                            const timestamp = Date.now().toString();
                            let message=[]
                            message.push(NCP_method);
                            message.push(NCP_space);
                            message.push(NCP_url2);
                            message.push(NCP_newLine);
                            message.push(timestamp);
                            message.push(NCP_newLine);
                            message.push(security_key.NCP_accessKey);

                            let hmac=crypto.createHmac('sha256',security_key.NCP_secretKey);
                            const signature = hmac.update(message.join('')).digest('base64');
                            rs({
                                method: NCP_method,
                                json: true,
                                uri: NCP_url1,
                                headers: {
                                    'Content-Type': 'application/json; charset=utf-8',
                                    'x-ncp-iam-access-key' : security_key.NCP_accessKey,
                                    'x-ncp-apigw-timestamp': timestamp,
                                    'x-ncp-apigw-signature-v2': signature.toString()
                                },
                                body: {
                                    "type":"MMS",
                                    "contentType":"COMM",
                                    "countryCode":"82",
                                    "from": '01099237720',
                                    "content":'위드프레소\n안녕하세요.\n['+cafe_name+'] 인증 번호 ['+auth_code+']입니다.\n다운로드 링크는 ~입니다.',
                                    "messages":[
                                        {
                                            "to":`${user_phone_num}`,
                                        }
                                    ]
                                }
                            },function (err3, res3, html) {
                                if(err3) throw err3;
                                console.log(html);
                                res.send('1')
                            })
                          }
                        }
                      })

                    }

                  })
                }
              })
            }


            //디비에 유저가 있는지 찾는다.
            //있으면 그냥 인증번호
            //없으면 설치 메세지와 인증번호

        });
    }
})

app.post('/customer/auth_code',function (req, res) {
    if (req.method == 'POST') {
        var body = '';

        req.on('data', function (data) {
            body += data;

            if (body.length > 1e6)
                req.connection.destroy();
        });

        req.on('end', function () {
            var post = qs.parse(body);
            //var input_user_asin=post.user_asin
            var input_phone_num=post.phone_num
            var input_auth_code=post.auth_code
            var input_cafe_asin=post.cafe_asin

            if(input_phone_num===undefined||input_auth_code===undefined||input_cafe_asin===undefined){
              res.send('0')
            }
            else{
              var current_time = moment().format('YYYY-MM-DD HH:mm:ss');
              connection.query('select EXISTS (select * from auth where user_tel=\''+input_phone_num+'\'and cafe_asin=\''+input_cafe_asin+'\'and auth_code=\''+input_auth_code+'\' and valid_time > \''+current_time+'\') as is_existed',function(err,rows){
                if(err) throw err
                else{
                  var data=JSON.stringify(rows)
                  var parsed_data=JSON.parse(data)
                  if(parsed_data[0].is_existed===1){
                    connection.query('delete from auth where user_tel=\''+input_phone_num+'\'and cafe_asin=\''+input_cafe_asin+'\'and auth_code=\''+input_auth_code+'\' and valid_time > \''+current_time+'\'',function(err1,rows1){
                      if(err1) throw err1

                    })
                    res.send('1')
                  }
                  else{
                    res.send('0')
                  }
                }

              })
            }
        });
    }
})

app.post('/customer/rating',function (req, res) {
    if (req.method == 'POST') {
        var body = '';

        req.on('data', function (data) {
            body += data;

            if (body.length > 1e6)
                req.connection.destroy();
        });

        req.on('end', function () {
            var post = qs.parse(body);
            var input_user_clean_info=parseInt(post.user_clean_info)
            var input_user_toilet_clean_info=parseInt(post.user_toilet_clean_info)
            var input_user_noisy_info=parseInt(post.user_noisy_info)
            var input_user_good_study_info =parseInt(post.user_good_study_info)
            var input_cafe_asin=post.cafe_asin
            var input_user_asin=post.user_asin

            if(input_user_clean_info===undefined||input_user_toilet_clean_info===undefined||input_user_noisy_info===undefined||input_user_good_study_info===undefined||input_cafe_asin===undefined){
              res.send('0')
            }
            else{
              connection.query('select user_clean_info, user_toilet_clean_info, user_kindness_info, user_noisy_info, user_good_study_info, num_of_rate,discount, cafe_name from cafe_data where cafe_asin = \''+input_cafe_asin+'\'',function(err,rows){
                if (err) throw err

                var original_user_clean_info=rows[0].user_clean_info
                var original_user_toilet_clean_info=rows[0].user_toilet_clean_info
                var original_user_noisy_info=rows[0].user_noisy_info
                var original_user_good_study_info =rows[0].user_good_study_info
                var original_num_of_rate=rows[0].num_of_rate
                var cafe_discount=parseInt(rows[0].discount)
                var cafe_name=rows[0].cafe_name

                var new_num_of_rate=original_num_of_rate+1

                var new_user_clean_info=(((original_user_clean_info*original_num_of_rate)+input_user_clean_info)/(new_num_of_rate)).toFixed(3)
                var new_user_toilet_clean_info=(((original_user_toilet_clean_info*original_num_of_rate)+input_user_toilet_clean_info)/(new_num_of_rate)).toFixed(3)
                var new_user_noisy_info=(((original_user_noisy_info*original_num_of_rate)+input_user_noisy_info)/(new_num_of_rate)).toFixed(3)
                var new_user_good_study_info =(((original_user_clean_info*original_num_of_rate)+input_user_good_study_info)/(new_num_of_rate)).toFixed(3)

                connection.query('update cafe_data set user_clean_info = \''+new_user_clean_info+'\', user_toilet_clean_info = \''+new_user_toilet_clean_info+'\',user_noisy_info = \''+new_user_noisy_info+'\' ,user_good_study_info = \''+new_user_good_study_info+'\' ,num_of_rate = \''+new_num_of_rate+'\' where cafe_asin = \''+input_cafe_asin+'\'',function(err1,rows1){
                  if (err1) throw err1

                  else{
                    if(cafe_discount!=0){
                    var date = moment().add(3,'d').format('YYYY-MM-DD HH:mm:ss');
                    var auth_code= Math.floor(Math.random() * (999999 - 100000)) + 100000;
                    connection.query('INSERT INTO coupon (cafe_asin,user_asin,validity,discount_rate,coupon_type,coupon_code,cafe_name) VALUES (\''+input_cafe_asin+'\',\''+input_user_asin+'\',\''+date+'\',\''+cafe_discount+'\',\'리뷰 이벤트 쿠폰\',\''+auth_code+'\',\''+cafe_name+'\')',function(err2,rows2){
                      if(err2) throw err2
                      res.send('1')
                    })
                    }
                    else{
                      res.send('1')
                    }
                  }
                })
              })
            }

        });
    }
})

app.post('/customer/review/write',function (req, res) {
    if (req.method == 'POST') {
        var body = '';

        req.on('data', function (data) {
            body += data;


            if (body.length > 1e6)
                req.connection.destroy();
        });

        req.on('end', function () {
            var post = qs.parse(body);
            var input_user_asin=post.user_asin
            var input_cafe_asin=post.cafe_asin
            var input_review_contents=post.review_contents

            if(input_user_asin===undefined||input_cafe_asin===undefined||input_review_contents===undefined){
              res.send('0')
            }
            else{
              connection.query('select user_name from user_db where user_asin = \''+input_user_asin+'\'',function(err,rows){
                if(err) throw err

                var user_name=rows[0].user_name
                connection.query('INSERT INTO cafe_review (cafe_asin,user_asin,review,user_name) VALUES (\''+input_cafe_asin+'\',\''+input_user_asin+'\',\''+input_review_contents+'\',\''+user_name+'\')',function(err1,rows1){
                  if(err1) throw err1

                  res.send('1')
                })
              })
            }
        });
    }
})
//리뷰에 쓴 사람 이름 추가 가능 뭔가 for문 돌아서 붙여주면 될듯? + page수
app.get('/customer/review/view',function(req,res){
  var input_cafe_asin=req.query.cafe_asin
  if(input_cafe_asin===undefined){
    res.send('0')
  }
  else{
    connection.query('select * from cafe_review where cafe_asin = \''+input_cafe_asin+'\'',function(err,rows){
      if(err) throw err
      res.send(rows)
    })
  }
})

app.post('/owner/coupon/check',function (req, res) {
    if (req.method == 'POST') {
        var body = '';

        req.on('data', function (data) {
            body += data;

            if (body.length > 1e6)
                req.connection.destroy();
        });

        req.on('end', function () {
            var post = qs.parse(body);
            input_cafe_asin=post.cafe_asin
            input_coupon_code=post.coupon_code

            if(input_cafe_asin==undefined || input_coupon_code==undefined){
              res.send('0')
            }
            else{
              var current_time = moment().format('YYYY-MM-DD HH:mm:ss');
              connection.query('select EXISTS (select * from coupon where cafe_asin = \''+input_cafe_asin+'\' and coupon_code = \''+input_coupon_code+'\' and validity > \''+current_time+'\' ) as is_existed',function(err,rows){
                if(err) throw err

                else{
                  var data=JSON.stringify(rows)
                  var parsed_data=JSON.parse(data)
                  if(parsed_data[0].is_existed===1){
                    connection.query('delete from coupon where cafe_asin = \''+input_cafe_asin+'\' and coupon_code = \''+input_coupon_code+'\'',function(err1,rows1){
                      if(err1) throw err1

                      res.send('1')
                    })
                  }
                  else{
                    res.send('0')
                  }
                }
              })
            }

        });
    }
})

app.get('/customer/coupon/check',function(req,res){
  var input_user_asin=req.query.user_asin

  if(input_user_asin===undefined){
    res.send('0')
  }
  else{
    var current_time = moment().format('YYYY-MM-DD HH:mm:ss');
    connection.query('select * from coupon where user_asin=\''+input_user_asin+'\' and discount_rate!=0 and validity > \''+current_time+'\'',function(err,rows){
      if(err) throw err

      res.send(rows)
    })
  }
})

app.post('/owner/num_of_customer',function (req, res) {
    if (req.method == 'POST') {
        var body = '';

        req.on('data', function (data) {
            body += data;

            if (body.length > 1e6)
                req.connection.destroy();
        });

        req.on('end', function () {
            var post = qs.parse(body);
            var input_cafe_asin=post.cafe_asin
            var input_num_of_customer=post.num_of_customer
            var input_level=post.level

            if(input_cafe_asin===undefined||input_num_of_customer===undefined||input_level===undefined){
              res.send('0')
            }
            else{
              connection.query('update cafe_data set num_of_customer=\''+input_num_of_customer+'\', complexity_level=\''+input_level+'\' where cafe_asin =\''+input_cafe_asin+'\'',function(err,rows){
                if(err) throw err
                res.send('1')
              })
            }

        });
    }
})

app.post('/machine/num_of_customer',function(req,res){
  if (req.method == 'POST') {
      var body = '';

      req.on('data', function (data) {
          body += data;

          if (body.length > 1e6)
              req.connection.destroy();
      });

      req.on('end', function () {
          var post = qs.parse(body);
          var input_cafe_asin=post.cafe_asin
          var input_num_of_customer=post.num_of_customer
          var input_level=post.level

          if(input_cafe_asin===undefined||input_num_of_customer===undefined||input_level===undefined){
            res.send('0')
          }
          else{
            connection.query('update cafe_data set num_of_customer=\''+input_num_of_customer+'\', complexity_level=\''+input_level+'\' where cafe_asin =\''+input_cafe_asin+'\'',function(err,rows){
              if(err) throw err
              res.send('1')
            })
          }

      });
  }
})

app.get('/machine/get_num_of_customer',function(req,res){
  var input_cafe_asin=req.query.cafe_asin

  if(input_cafe_asin===undefined){
    res.send('0')
  }
  else{
    connection.query('select num_of_customer, complexity_level from cafe_data where cafe_asin = \''+input_cafe_asin+'\'',function(err,rows){
      if(err) throw(err)

      res.send(rows)
    })
  }

})

app.get('/test/message',function(req,res){



  var to_tell_num=req.query.phone_num
  var cafe_asin=req.query.cafe_asin



  const timestamp = Date.now().toString();


  let message=[]

  message.push(NCP_method);
  message.push(NCP_space);
  message.push(NCP_url2);
  message.push(NCP_newLine);
  message.push(timestamp);
  message.push(NCP_newLine);
  message.push(security_key.NCP_accessKey);


  if(to_tell_num===undefined || cafe_asin===undefined){
    res.send('0')
  }
  else{

    rs({
        method: NCP_method,
        json: true,
        uri: NCP_url1,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'x-ncp-iam-access-key' : security_key.NCP_accessKey,
            'x-ncp-apigw-timestamp': timestamp,
            'x-ncp-apigw-signature-v2': signature.toString()
        },
        body: {
            "type":"SMS",
            "contentType":"COMM",
            "countryCode":"82",
            "from": '01099237720',
            "content":'위드프레소\n[어디 카페] 인증 번호\n[인증번호]입니다',
            "messages":[
                {
                    "to":`${to_tell_num}`,
                }
            ]
        }
    },function (err1, res2, html) {
        if(err1) console.log(err1);
        console.log(html);
        res.send('1')
    });
  }



})


    /**/



/*post로 통신하는 법
function (req, res) {
    if (req.method == 'POST') {
        var body = '';

        req.on('data', function (data) {
            body += data;

            // Too much POST data, kill the connection!
            // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
            if (body.length > 1e6)
                req.connection.destroy();
        });

        req.on('end', function () {
            var post = qs.parse(body);
            // use post['blah'], etc.
        });
    }
}
*/



//가까이에 있는(같은 동) 카페를 출려해주는 과정이다.
app.get('/print_cafe', (req, res) => {
  res.send('This is print_cafe page')
})

